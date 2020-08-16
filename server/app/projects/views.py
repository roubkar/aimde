import json
import os
import time

from flask import (
    abort,
    jsonify,
    request,
    Blueprint,
    make_response,
    send_from_directory,
)
from flask_restful import Api, Resource

from app.db import db
from app.projects.utils import (
    read_artifact_log,
    get_branch_commits,
)
from app.projects.project import Project
from artifacts.artifact import Metric as MetricRecord


projects_bp = Blueprint('projects', __name__)
projects_api = Api(projects_bp)


@projects_api.resource('/')
class ProjectApi(Resource):
    def get(self):
        project = Project()

        if not project.exists():
            return make_response(jsonify({}), 404)

        return jsonify({
            'name': project.name,
            'path': project.path,
            'tf_enabled': project.tf_enabled,
            'description': project.description,
            'branches': project.repo.list_branches(),
        })


@projects_api.resource('/info')
class ProjectDataApi(Resource):
    def get(self):
        project = Project()

        if not project.exists():
            return make_response(jsonify({}), 404)

        return jsonify({
            'branches': project.repo.list_branches(),
        })


@projects_api.resource('/<exp_name>/<commit>/models/<model_name>')
class ExperimentModelApi(Resource):
    def get(self, exp_name, commit, model_name):
        dir_path = os.path.join('/store', exp_name, commit)
        objects_dir_path = os.path.join(dir_path, 'objects')
        models_dir_path = os.path.join(objects_dir_path, 'models')

        return send_from_directory(directory=models_dir_path,
                                   filename=model_name)


@projects_api.resource('/<experiment_name>/<commit_id>')
class ProjectExperimentApi(Resource):
    def get(self, experiment_name, commit_id):
        project = Project()

        if not project.exists():
            return make_response(jsonify({}), 404)

        dir_path = os.path.join('/store', experiment_name)

        # Check if experiment exists
        if not os.path.isdir(dir_path):
            return jsonify({
                'init': True,
                'branch_init': False,
            })

        # Get commits
        commits = get_branch_commits(dir_path)

        # Get specified commit
        commit = None
        if commit_id == 'latest':
            for commit_item, config in commits.items():
                if commit is None or config['date'] > commit['date']:
                    commit = config
        elif commit_id == 'index':
            commit = {
                'hash': 'index',
                'date': time.time(),
                'index': True,
            }
        else:
            commit = commits.get(commit_id)

        if hasattr(commit, 'process'):
            if not commit['process']['finish']:
                if commit['process'].get('start_date'):
                    duration = time.time() - commit['process']['start_date']
                    commit['process']['time'] = duration
                else:
                    commit['process']['time'] = None
            elif commit['process'].get('start_date') is not None \
                    and commit['process'].get('finish_date') is not None:
                commit['process']['time'] = commit['process']['finish_date'] \
                                            - commit['process']['start_date']

        if not commit:
            return make_response(jsonify({}), 404)

        objects_dir_path = os.path.join(dir_path, commit['hash'], 'objects')
        meta_file_path = os.path.join(objects_dir_path, 'meta.json')

        # Read meta file content
        try:
            with open(meta_file_path, 'r+') as meta_file:
                meta_file_content = json.loads(meta_file.read())
        except:
            meta_file_content = {}

        if commit['hash'] == 'index' and len(meta_file_content) == 0:
            return jsonify({
                'init': True,
                'branch_init': True,
                'index_empty': True,
                'commit': commit,
                'commits': commits,
            })

        # Get all artifacts(objects) listed in the meta file
        metric_objects = []
        model_objects = []
        dir_objects = []
        map_objects = []
        stats_objects = []

        # Limit distributions
        for obj_key, obj in meta_file_content.items():
            if obj['type'] == 'dir':
                dir_objects.append({
                    'name': obj['name'],
                    'cat': obj['cat'],
                    'data': obj['data'],
                    'data_path': obj['data_path'],
                })
            elif obj['type'] == 'models':
                model_file_path = os.path.join(objects_dir_path,
                                               'models',
                                               '{}.aim'.format(obj['name']))
                model_file_size = os.stat(model_file_path).st_size
                model_objects.append({
                    'name': obj['name'],
                    'data': obj['data'],
                    'size': model_file_size,
                })
            elif (obj['type'] == 'metrics'
                  and obj['data_path'] != '__AIMRECORDS__') or \
                    ('map' in obj['type'] or obj['type'] == 'map'):
                    # obj['type'] == 'distribution':
                # Get object's data file path
                obj_data_file_path = os.path.join(objects_dir_path,
                                                  obj['data_path'],
                                                  obj_key)

                # Incompatible version
                if obj_key.endswith('.json'):
                    return make_response(jsonify({}), 501)

            if obj['type'] == 'metrics':
                steps = 75
                run = project.repo.select_run_metrics(experiment_name,
                                                      commit['hash'],
                                                      obj['name'])
                if run is not None and run.metrics.get(obj['name']) \
                        and len(run.metrics[obj['name']].traces):
                    metric = run.metrics[obj['name']]
                    run.open_storage()
                    metric.open_artifact()
                    traces = []
                    for trace in metric.traces:
                        num = trace.num_records
                        step = num // steps or 1
                        for r in trace.read_records(slice(0, num, step)):
                            base, metric_record = MetricRecord.deserialize(r)
                            trace.append((
                                base.step,  # 0 => step
                                metric_record.value,  # 1 => value
                            ))
                        traces.append(trace.to_dict())
                    metric.close_artifact()
                    run.close_storage()
                else:
                    traces = []

                metric_objects.append({
                    'name': obj['name'],
                    'mode': 'plot',
                    'traces': traces,
                })
            elif 'map' in obj['type'] or obj['type'] == 'map':
                try:
                    params_str = read_artifact_log(obj_data_file_path, 1)
                    if params_str:
                        map_objects.append({
                            'name': obj['name'],
                            'data': json.loads(params_str[0]),
                            'nested': 'nested_map' in obj['type']
                        })
                except:
                    pass

        # Return found objects
        return jsonify({
            'init': True,
            'branch_init': True,
            'commit': commit,
            'commits': commits,
            'metrics': metric_objects,
            'models': model_objects,
            'dirs': dir_objects,
            'maps': map_objects,
            'stats': stats_objects,
        })


@projects_api.resource('/insight/<insight_name>')
class ProjectInsightApi(Resource):
    def get(self, insight_name):
        return make_response(jsonify({}), 404)


@projects_api.resource('/<experiment_name>/<commit_id>/<file_path>')
class ProjectExperimentFileApi(Resource):
    def get(self, experiment_name,
            commit_id, file_path):
        project = Project()

        if not project.exists():
            return make_response(jsonify({}), 404)

        objects_dir_path = os.path.join('/store',
                                        experiment_name,
                                        commit_id,
                                        'objects')

        file_path = os.path.join(*file_path.split('+')) + '.log'
        dist_abs_path = os.path.join(objects_dir_path,
                                     file_path)

        if not os.path.isfile(dist_abs_path):
            return make_response(jsonify({}), 404)

        # Read file specified by found path
        try:
            obj_data_content = read_artifact_log(dist_abs_path, 500)
            comp_content = list(map(lambda x: json.loads(x),
                                    obj_data_content))
            return comp_content
        except:
            return []
