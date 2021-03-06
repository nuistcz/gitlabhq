import MockAdapter from 'axios-mock-adapter';
import axios from '~/lib/utils/axios_utils';
import {
  refreshLastCommitData,
  showBranchNotFoundError,
  createNewBranchFromDefault,
  getBranchData,
  openBranch,
} from '~/ide/stores/actions';
import store from '~/ide/stores';
import service from '~/ide/services';
import api from '~/api';
import router from '~/ide/ide_router';
import { resetStore } from '../../helpers';
import testAction from '../../../helpers/vuex_action_helper';

describe('IDE store project actions', () => {
  let mock;

  beforeEach(() => {
    mock = new MockAdapter(axios);

    store.state.projects['abc/def'] = {
      branches: {},
    };
  });

  afterEach(() => {
    mock.restore();

    resetStore(store);
  });

  describe('refreshLastCommitData', () => {
    beforeEach(() => {
      store.state.currentProjectId = 'abc/def';
      store.state.currentBranchId = 'master';
      store.state.projects['abc/def'] = {
        id: 4,
        branches: {
          master: {
            commit: null,
          },
        },
      };
      spyOn(service, 'getBranchData').and.returnValue(
        Promise.resolve({
          data: {
            commit: { id: '123' },
          },
        }),
      );
    });

    it('calls the service', done => {
      store
        .dispatch('refreshLastCommitData', {
          projectId: store.state.currentProjectId,
          branchId: store.state.currentBranchId,
        })
        .then(() => {
          expect(service.getBranchData).toHaveBeenCalledWith('abc/def', 'master');

          done();
        })
        .catch(done.fail);
    });

    it('commits getBranchData', done => {
      testAction(
        refreshLastCommitData,
        {
          projectId: store.state.currentProjectId,
          branchId: store.state.currentBranchId,
        },
        store.state,
        // mutations
        [
          {
            type: 'SET_BRANCH_COMMIT',
            payload: {
              projectId: 'abc/def',
              branchId: 'master',
              commit: { id: '123' },
            },
          },
        ],
        // action
        [],
        done,
      );
    });
  });

  describe('showBranchNotFoundError', () => {
    it('dispatches setErrorMessage', done => {
      testAction(
        showBranchNotFoundError,
        'master',
        null,
        [],
        [
          {
            type: 'setErrorMessage',
            payload: {
              text: "Branch <strong>master</strong> was not found in this project's repository.",
              action: jasmine.any(Function),
              actionText: 'Create branch',
              actionPayload: 'master',
            },
          },
        ],
        done,
      );
    });
  });

  describe('createNewBranchFromDefault', () => {
    it('calls API', done => {
      spyOn(api, 'createBranch').and.returnValue(Promise.resolve());
      spyOn(router, 'push');

      createNewBranchFromDefault(
        {
          state: {
            currentProjectId: 'project-path',
          },
          getters: {
            currentProject: {
              default_branch: 'master',
            },
          },
          dispatch() {},
        },
        'new-branch-name',
      )
        .then(() => {
          expect(api.createBranch).toHaveBeenCalledWith('project-path', {
            ref: 'master',
            branch: 'new-branch-name',
          });
        })
        .then(done)
        .catch(done.fail);
    });

    it('clears error message', done => {
      const dispatchSpy = jasmine.createSpy('dispatch');
      spyOn(api, 'createBranch').and.returnValue(Promise.resolve());
      spyOn(router, 'push');

      createNewBranchFromDefault(
        {
          state: {
            currentProjectId: 'project-path',
          },
          getters: {
            currentProject: {
              default_branch: 'master',
            },
          },
          dispatch: dispatchSpy,
        },
        'new-branch-name',
      )
        .then(() => {
          expect(dispatchSpy).toHaveBeenCalledWith('setErrorMessage', null);
        })
        .then(done)
        .catch(done.fail);
    });

    it('reloads window', done => {
      spyOn(api, 'createBranch').and.returnValue(Promise.resolve());
      spyOn(router, 'push');

      createNewBranchFromDefault(
        {
          state: {
            currentProjectId: 'project-path',
          },
          getters: {
            currentProject: {
              default_branch: 'master',
            },
          },
          dispatch() {},
        },
        'new-branch-name',
      )
        .then(() => {
          expect(router.push).toHaveBeenCalled();
        })
        .then(done)
        .catch(done.fail);
    });
  });

  describe('getBranchData', () => {
    describe('error', () => {
      it('dispatches branch not found action when response is 404', done => {
        const dispatch = jasmine.createSpy('dispatchSpy');

        mock.onGet(/(.*)/).replyOnce(404);

        getBranchData(
          {
            commit() {},
            dispatch,
            state: store.state,
          },
          {
            projectId: 'abc/def',
            branchId: 'master-testing',
          },
        )
          .then(done.fail)
          .catch(() => {
            expect(dispatch.calls.argsFor(0)).toEqual([
              'showBranchNotFoundError',
              'master-testing',
            ]);
            done();
          });
      });
    });
  });

  describe('openBranch', () => {
    const branch = {
      projectId: 'feature/lorem-ipsum',
      branchId: '123-lorem',
    };

    beforeEach(() => {
      store.state.entries = {
        foo: { pending: false },
        'foo/bar-pending': { pending: true },
        'foo/bar': { pending: false },
      };

      spyOn(store, 'dispatch').and.returnValue(Promise.resolve());
    });

    it('dispatches branch actions', done => {
      openBranch(store, branch)
        .then(() => {
          expect(store.dispatch.calls.allArgs()).toEqual([
            ['setCurrentBranchId', branch.branchId],
            ['getBranchData', branch],
            ['getFiles', branch],
          ]);
        })
        .then(done)
        .catch(done.fail);
    });

    it('handles tree entry action, if basePath is given', done => {
      openBranch(store, { ...branch, basePath: 'foo/bar/' })
        .then(() => {
          expect(store.dispatch).toHaveBeenCalledWith(
            'handleTreeEntryAction',
            store.state.entries['foo/bar'],
          );
        })
        .then(done)
        .catch(done.fail);
    });

    it('does not handle tree entry action, if entry is pending', done => {
      openBranch(store, { ...branch, basePath: 'foo/bar-pending' })
        .then(() => {
          expect(store.dispatch).not.toHaveBeenCalledWith(
            'handleTreeEntryAction',
            jasmine.anything(),
          );
        })
        .then(done)
        .catch(done.fail);
    });
  });
});
