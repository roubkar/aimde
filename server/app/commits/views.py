import json
import os
import time

from flask import Blueprint, jsonify, request, \
    abort, make_response, send_from_directory
from flask_restful import Api, Resource

from aim.ql.grammar.statement import Statement

from app import App
from app.projects.project import Project
from app.commits.models import Commit, TFSummaryLog, Tag
from services.executables.action import Action
from app.db import db
from adapters.tf_summary_adapter import TFSummaryAdapter
from artifacts.artifact import Metric as MetricRecord
from app.commits.utils import (
    select_tf_summary_scalars,
    scale_trace_steps,
    separate_select_statement,
    is_tf_run,
)


commits_bp = Blueprint('commits', __name__)
commits_api = Api(commits_bp)


@commits_api.resource('/search/metric')
class CommitMetricSearchApi(Resource):
    def get(self):
        search_statement = request.args.get('q').strip()

        # TODO: get from request
        steps_num = 50

        runs = []

        # Parse statement
        try:
            parser = Statement()
            parsed_stmt = parser.parse(search_statement.strip())
        except:
            return make_response(jsonify({}), 403)

        statement_select = parsed_stmt.node['select']
        statement_expr = parsed_stmt.node['expression']

        aim_runs, tf_logs = separate_select_statement(statement_select)

        # Get project
        project = Project()
        if not project.exists():
            return make_response(jsonify({}), 404)

        try:
            aim_metrics = project.repo.select_metrics(aim_runs, statement_expr)
            if aim_metrics and len(aim_metrics):
                runs += aim_metrics
        except:
            pass

        # Get tf.summary logs
        if len(tf_logs) > 0:
            try:
                tf_runs = select_tf_summary_scalars(tf_logs, statement_expr)
                if tf_runs and len(tf_runs):
                    runs += tf_runs
            except:
                pass

        # Get the longest trace length
        max_num_records = 0
        for run in runs:
            if is_tf_run(run):
                for metric in run['metrics']:
                    for trace in metric['traces']:
                        if trace['num_steps'] > max_num_records:
                            max_num_records = trace['num_steps']
            else:
                run.open_storage()
                for metric in run.metrics.values():
                    try:
                        metric.open_artifact()
                        for trace in metric.traces:
                            if trace.num_records > max_num_records:
                                max_num_records = trace.num_records
                    except:
                        pass
                    finally:
                        pass
            #         metric.close_artifact()
            # run.close_storage()

        # Scale all traces
        steps = scale_trace_steps(max_num_records, steps_num)

        # Retrieve records
        for run in runs:
            if is_tf_run(run):
                for metric in run['metrics']:
                    for trace in metric['traces']:
                        trace_range = range(len(trace['data']))[steps.start:
                                                                steps.stop:
                                                                steps.step]
                        trace_scaled_data = []
                        for i in trace_range:
                            trace_scaled_data.append(trace['data'][i])
                        trace['data'] = trace_scaled_data
            else:
                # run.open_storage()
                for metric in run.metrics.values():
                    try:
                        # metric.open_artifact()
                        for trace in metric.traces:
                            for r in trace.read_records(steps):
                                base, metric_record = MetricRecord.deserialize(r)
                                trace.append((
                                    metric_record.value,           # 0 => value
                                    base.step,                     # 1 => step
                                    (base.epoch if base.has_epoch  # 2 => epoch
                                     else None),                   #
                                     base.timestamp,               # 3 => time
                                ))
                    except:
                        pass
                    finally:
                        metric.close_artifact()
                run.close_storage()

        runs_list = []
        for run in runs:
            if not is_tf_run(run):
                runs_list.append(run.to_dict())
            else:
                runs_list.append(run)

        return jsonify({
            'runs': runs_list,
        })


@commits_api.resource('/search/dictionary')
class CommitDictionarySearchApi(Resource):
    def get(self):
        # Get tf logs saved params
        # tf_logs_params = {}
        # tf_logs = TFSummaryLog.query.filter(
        #     TFSummaryLog.is_archived.is_(False)) \
        #     .all()
        #
        # for tf_log in tf_logs:
        #     tf_logs_params[tf_log.log_path] = {
        #         'data': tf_log.params_json,
        #     }
        # for tf_log_path, tf_log_params in tf_logs_params.items():
        #     dicts[tf_log_path] = tf_log_params

        return jsonify({})


@commits_api.resource('/tf-summary/list')
class TFSummaryListApi(Resource):
    def get(self):
        dir_paths = TFSummaryAdapter.list_log_dir_paths()
        return jsonify(dir_paths)


@commits_api.resource('/tf-summary/params/list')
class TFSummaryParamsListApi(Resource):
    def post(self):
        params_form = request.form
        path = params_form.get('path')

        if not path:
            return jsonify({'params': ''})

        tf_log = TFSummaryLog.query.filter((TFSummaryLog.log_path == path) &
                                           (TFSummaryLog.is_archived.is_(False))
                                           ).first()
        if tf_log is None:
            return jsonify({'params': ''})

        return jsonify({
            'params': tf_log.params,
        })


@commits_api.resource('/tf-summary/params/update')
class TFSummaryParamsUpdateApi(Resource):
    def post(self):
        params_form = request.form
        path = params_form.get('path')
        params = params_form.get('params')
        parsed_params = params_form.get('parsed_params')

        if not path:
            return make_response(jsonify({}), 403)

        tf_log = TFSummaryLog.query.filter((TFSummaryLog.log_path == path) &
                                           (TFSummaryLog.is_archived.is_(False))
                                           ).first()
        if tf_log is None:
            tf_log = TFSummaryLog(path)
            db.session.add(tf_log)

        tf_log.params = params
        tf_log.params_json = json.loads(parsed_params) if params else None
        db.session.commit()

        return jsonify({
            'params': params,
        })


@commits_api.resource('/tags/<commit_hash>')
class CommitTagApi(Resource):
    def get(self, commit_hash):
        commit = Commit.query.filter(Commit.hash == commit_hash).first()

        if not commit:
            return make_response(jsonify({}), 404)

        commit_tags = []
        for t in commit.tags:
            commit_tags.append({
                'id': t.uuid,
                'name': t.name,
                'color': t.color,
            })

        return jsonify(commit_tags)


@commits_api.resource('/tags/update')
class CommitTagUpdateApi(Resource):
    def post(self):
        form = request.form

        commit_hash = form.get('commit_hash')
        experiment_name = form.get('experiment_name')
        tag_id = form.get('tag_id')

        commit = Commit.query.filter((Commit.hash == commit_hash) &
                                     (Commit.experiment_name == experiment_name)
                                     ).first()
        if not commit:
            commit = Commit(commit_hash, experiment_name)
            db.session.add(commit)
            db.session.commit()

        tag = Tag.query.filter(Tag.uuid == tag_id).first()
        if not tag:
            return make_response(jsonify({}), 404)

        if tag in commit.tags:
            commit.tags.remove(tag)
        else:
            for t in commit.tags:
                commit.tags.remove(t)
            commit.tags.append(tag)

        db.session.commit()

        return {
            'tag': list(map(lambda t: t.uuid, commit.tags)),
        }


@commits_api.resource('/info/<experiment>/<commit_hash>')
class CommitInfoApi(Resource):
    def get(self, experiment, commit_hash):
        commit_path = os.path.join('/store', experiment, commit_hash)

        if not os.path.isdir(commit_path):
            return make_response(jsonify({}), 404)

        commit_config_file_path = os.path.join(commit_path, 'config.json')
        info = {}

        try:
            with open(commit_config_file_path, 'r+') as commit_config_file:
                info = json.loads(commit_config_file.read())
        except:
            pass

        process = info.get('process')
        if process:
            if not process['finish']:
                if process.get('start_date'):
                    process['time'] = time.time() - process['start_date']
                else:
                    process['time'] = None

                # Get PID
                action = Action(Action.SELECT, {
                    'experiment': experiment,
                    'commit_hash': commit_hash,
                })
                processes_res = App.executables_manager.add(action, 30)
                if processes_res is not None and 'processes' in processes_res:
                    processes = json.loads(processes_res)['processes']
                    if len(processes):
                        process['pid'] = processes[0]['pid']

        return jsonify(info)
