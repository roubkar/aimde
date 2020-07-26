import os
from aimrecords import Storage
import json

from app.projects.utils import get_branch_commits
from app.db import db
from app.commits.models import Commit, Tag, TFSummaryLog
from artifacts.artifact import Metric
from adapters.tf_summary_adapter import TFSummaryAdapter


PROJECT_PATH = '/store'


def get_run_objects_path(b, c):
    return os.path.join(b, c, 'objects')


def get_branches():
    branches = []

    config_file_path = os.path.join(PROJECT_PATH, 'config.json')
    if not os.path.isfile(config_file_path):
        return branches

    with open(config_file_path, 'r') as config_file:
        config_content = json.loads(config_file.read().strip())

    branches = config_content.get('branches') or []
    branches = list(map(lambda b: b['name'], branches))

    return branches


def get_runs_hashes(tag=None, experiments=None, params=None):
    project_branches = get_branches()

    # Filter by experiments
    if experiments and isinstance(experiments, str):
        experiments = filter(lambda e: e,
                             map(lambda e: e.strip(), experiments.split(',')))
        project_branches = [e for e in experiments if e in project_branches]

    # Get all commit objects
    commit_objects = {}
    for branch in project_branches:
        branch_path = os.path.join(PROJECT_PATH, branch)
        branch_commits = get_branch_commits(branch_path)
        for c in branch_commits.values():
            commit_objects[c['hash']] = {
                'branch': branch,
                'hash': c['hash'],
                'date': c['date'],
                'msg': c['message'],
            }

    # Filter by tag
    commit_hashes_by_tag = set()
    if tag is not None:
        tags = Tag.query.filter(Tag.name.like('{}%'.format(tag))).all()
        for t in tags:
            for tag_commit in t.commits:
                commit_hashes_by_tag.add(tag_commit.hash)

        filtered_runs = {c_hash: commit_objects[c_hash]
                         for c_hash in commit_hashes_by_tag}
    else:
        filtered_runs = commit_objects

    # Filter by params
    if params is not None:
        i = 0
        while i < len(filtered_runs):
            c_hash, c_obj = list(filtered_runs.items())[i]
            branch_path = os.path.join(PROJECT_PATH, c_obj['branch'])
            c_path = get_run_objects_path(branch_path, c_hash)
            dict_path = os.path.join(c_path, 'map', 'dictionary.log')
            if os.path.isfile(dict_path):
                try:
                    with open(dict_path, 'r') as c_config_file:
                        c_params = json.loads((c_config_file.read() or '')
                                              .strip())
                        c_params_flat = {}
                        for namespace, sub_params in c_params.items():
                            for sub_k, sub_v in sub_params.items():
                                c_params_flat[sub_k] = sub_v

                        matched = True
                        for s_param_k, s_param in params.items():
                            val = s_param['value']
                            if s_param_k not in c_params_flat \
                                or str(c_params_flat[s_param_k]) != str(val):
                                matched = False
                                break
                        if matched:
                            i += 1
                            continue
                except:
                    pass
            del filtered_runs[c_hash]

    return filtered_runs.values()


def get_runs_metric(metrics, tag=None, experiments=None, params=None):
    if not metrics:
        return []

    filtered_runs = get_runs_hashes(tag, experiments, params)

    # Get commits data length
    max_commit_len = 0
    for run in filtered_runs:
        branch_path = os.path.join(PROJECT_PATH, run['branch'])
        storage_path = get_run_objects_path(branch_path, run['hash'])
        records_storage = Storage(storage_path, 'r')
        for metric in metrics:
            try:
                records_storage.open(metric,
                                     uncommitted_bucket_visible=True)
                run['num_steps'] = records_storage.get_records_num(metric)
                records_storage.close()
            except:
                run['num_steps'] = 0
            if run['num_steps'] > max_commit_len:
                max_commit_len = run['num_steps']

    # Remove empty runs
    filtered_runs = list(filter(lambda r: r['num_steps'] > 0,
                                filtered_runs))

    # Get tags and colors
    commit_models = db.session.query(Commit, Tag) \
        .join(Tag, Commit.tags) \
        .filter(Commit.hash.in_(map(lambda r: r['hash'], filtered_runs))).all()
    for i in commit_models:
        if len(i) <= 1 or not i[1].color:
            continue

        commit_model = i[0]
        commit_tag = i[1]
        for commit in filtered_runs:
            if commit['hash'] == commit_model.hash:
                commit['tag'] = {
                    'name': commit_tag.name,
                    'color': commit_tag.color,
                }

    return filtered_runs


def get_tf_summary_scalars(tags, params=None):
    scalars = []

    # Get directory paths
    dir_paths = TFSummaryAdapter.list_log_dir_paths()

    # Filter by params
    if params is not None and len(params) > 0:
        filter_q = None
        for s_param in params.values():
            filter_exp = TFSummaryLog.params_json[s_param['key']].astext \
                         == s_param['value']
            if filter_q is None:
                filter_q = filter_exp
            else:
                filter_q &= filter_exp
        searched_logs = db.session.query(TFSummaryLog).filter(filter_q).all()
        if searched_logs and len(searched_logs) > 0:
            searched_paths = list(map(lambda l: l.log_path, searched_logs))
            i = 0
            while i < len(dir_paths):
                matched = False
                for s in searched_paths:
                    if s == dir_paths[i]:
                        matched = True
                        break
                if matched:
                    i += 1
                else:
                    del dir_paths[i]
        else:
            dir_paths = []

    # Get scalar paths
    for dir_path in dir_paths:
        tf = TFSummaryAdapter(dir_path)
        dir_scalars = tf.get_scalars(tags)
        if dir_scalars and len(dir_scalars) > 0:
            # Append only the first scalar
            # TODO: Add support for processing multiple metrics
            scalars.append(dir_scalars[0])

    max_scalar_len = 0
    for scalar in scalars:
        if scalar['num_steps'] > max_scalar_len:
            max_scalar_len = scalar['num_steps']

    return scalars


def retrieve_scale_metrics(runs, metrics, scaled_steps):
    for run in runs:
        if run.get('source') == 'tf_summary':
            run_len = len(run['data'])
            run_range = range(run_len)[scaled_steps.start:
                                       scaled_steps.stop:
                                       scaled_steps.step]
            run_scaled_data = []
            for i in run_range:
                run_scaled_data.append(run['data'][i])
            run['data'] = run_scaled_data
        else:
            # Retrieve aim metrics
            branch_path = os.path.join(PROJECT_PATH, run['branch'])
            storage_path = get_run_objects_path(branch_path, run['hash'])
            run['data'] = []
            records_storage = Storage(storage_path, 'r')
            for metric in metrics:
                try:
                    records_storage.open(metric,
                                         uncommitted_bucket_visible=True)
                    for r in records_storage.read_records(metric,
                                                          scaled_steps):
                        base, metric_record = Metric.deserialize(r)
                        run['data'].append({
                            'value': metric_record.value,
                            'step': base.step,
                            'epoch': base.epoch if base.has_epoch else None,
                        })
                    records_storage.close()
                except:
                    pass


def scale_metric_steps(max_metric_len, max_steps):
    scaled_steps_len = max_steps
    if scaled_steps_len > max_metric_len:
        scaled_steps_len = max_metric_len
    if scaled_steps_len:
        scaled_steps = slice(0, max_metric_len,
                             max_metric_len // scaled_steps_len)
    else:
        scaled_steps = slice(0, 0)
    return scaled_steps


def get_runs_dictionary(tag=None, experiments=None):
    filtered_runs = get_runs_hashes(tag, experiments)
    runs_dicts = {}

    for commit in filtered_runs:
        commit_hash = commit['hash']
        runs_dicts[commit_hash] = {
            'data': {},
        }
        branch_path = os.path.join(PROJECT_PATH, commit['branch'])
        storage_path = get_run_objects_path(branch_path, commit['hash'])
        dict_file_path = os.path.join(storage_path, 'map', 'dictionary.log')
        if os.path.isfile(dict_file_path):
            try:
                with open(dict_file_path, 'r') as dict_file:
                    json_content = (dict_file.read() or '').strip()
                    runs_dicts[commit_hash]['data'] = json.loads(json_content)
            except:
                pass

    return runs_dicts


def get_tf_logs_params():
    params = {}

    tf_logs = TFSummaryLog.query.filter(TFSummaryLog.is_archived.is_(False))\
        .all()

    for tf_log in tf_logs:
        params[tf_log.log_path] = {
            'data': tf_log.params_json,
        }

    return params


def parse_query(query):
    sub_queries = query.split(' ')
    metrics = tag = experiment = params = steps = None
    include = []
    for sub_query in sub_queries:
        if 'metric' in sub_query:
            if metrics is None:
                metrics = []
            _, _, metric = sub_query.rpartition(':')
            metrics.append(metric.strip())

        if 'tag' in sub_query:
            _, _, tag = sub_query.rpartition(':')
            tag = tag.lower().strip()

        if 'experiment' in sub_query:
            _, _, experiment = sub_query.rpartition(':')
            experiment = experiment.lower().strip()

        if 'step' in sub_query:
            _, _, steps = sub_query.rpartition(':')
            try:
                steps = int(steps)
            except:
                pass

        if 'param' in sub_query:
            if params is None:
                params = {}
            _, _, param = sub_query.rpartition(':')
            if '=' in param:
                param_key, param_op, param_val = param.rpartition('=')
                params[param_key] = {
                    'op': param_op,
                    'key': param_key,
                    'value': param_val,
                }

        if 'include' in sub_query:
            _, _, include_q = sub_query.rpartition(':')
            include = include_q.lower().strip().split(',')

    return {
        'metrics': metrics,
        'tag': tag,
        'experiment': experiment,
        'params': params,
        'steps': steps,
        'include': include,
    }
