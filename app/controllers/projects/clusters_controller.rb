class Projects::ClustersController < Projects::ApplicationController
  # before_action :authenticate_google_api
  before_action :cluster

  # before_action :authorize_admin_clusters! # TODO: Authentication

  def index
    if cluster
      redirect_to action: 'edit'
    else
      redirect_to action: 'new'
    end
  end

  ##
  # TODO: 
  # - Show form for "Create on Google Container Engine"
  # - Show form for "Use existing kubernets cluster"
  # - If user has not authroized yet, Show "Sign in with Google" button
  # - If user has already authroized, Skip "Sign in with Google" button
  # - user.is_authenticated_for_gcp?
  # - user.authenticate_for_gcp!
  # - Create this module which can be used from view
  def new
    unless session[GoogleApi::CloudPlatform::Client.token_in_session]
      @authorize_url = api_client.authorize_url
    end
  end

  ##
  # TODO: 
  # - If create on GKE, Use Google::Apis::ContainerV1::ContainerService
  # - If create manually, save in db (Prob, Project > Setting)
  # - Dry up with Service
  def create
    if params['creation_type'] == 'on_gke'
      results = api_client.projects_zones_clusters_create(
        params['gcp_project_id'],
        params['cluster_zone'],
        params['cluster_name'],
        params['cluster_size']
      )

      # TODO: How to create
      project.kubernetes_service.save(
        end_point: results['end_point'],
        ca_cert: results['ca_cert'],
        token: nil,
        username: results['username'],
        password: results['password'],
        project_namespace: params['project_namespace']
      )

      project.clusters.create(
        creation_type: params['creation_type'],
        gcp_project_id: params['gcp_project_id'],
        cluster_zone: params['cluster_zone'],
        cluster_name: params['cluster_name'],
        kubernetes_service: project.kubernetes_service
      )
    elsif params['creation_type'] == 'manual'
      # TODO: Transaction
      project.kubernetes_service.save(
        end_point: params['end_point'],
        ca_cert: params['ca_cert'],
        token: params['token'],
        username: params['username'],
        password: params['password'],
        project_namespace: params['project_namespace']
      )

      project.clusters.create(
        creation_type: params['creation_type'],
        kubernetes_service: project.kubernetes_service
      )
    end

    redirect_to action: 'index'
  end

  # TODO: Show results/status. Edits Swtich for enable/disable.
  # If created with GKE, non-editable form. enable/disable switch.
  # If created manually, editable form. enable/disable switch.
  # GKE params are   on-off swtich
  # Manul params are on-off swtich, Endpoint, CACert, k8s Token, Proj namespace.
  def edit
    unless session[GoogleApi::CloudPlatform::Client.token_in_session]
      @authorize_url = api_client.authorize_url
    end
  end

  def update
    cluster.update(schedule_params)
    render :edit
  end

  # In presenter
  # TODO: Generate a link to the cluster on GKE

  def gcp_projects
    # api_client.blah
    # TODO: Return all avaiable GCP Projects.
    # TODO: Return json
    # TODO: Dry with concern
  end

  def gke_zones
    # api_client.blah
    # TODO: Return all avaiable zones on GKE.
    # TODO: Return json
    # TODO: Dry with concern
  end

  private

  # def authenticate_google_api
  #   if cluster&.on_gke? && session[access_token_key].blank?
  #     redirect_to api_client.authorize_url(callback_import_url)
  #   end
  # end

  def cluster
    # Each project has only one cluster, for now. In the future iteraiton, we'll support multiple clusters
    @cluster ||= project.clusters.first
  end

  # def cluster_params
  #   params.require(:cluster).permit(:aaa)
  # end

  def api_client
    @api_client ||=
      GoogleApi::CloudPlatform::Client.new(
        session[GoogleApi::CloudPlatform::Client.token_in_session],
        callback_google_api_authorizations_url,
        state: namespace_project_clusters_url.to_s
      )
  end
end
