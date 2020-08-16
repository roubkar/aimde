from typing import Optional
from aim.ql.grammar import Expression
from aim.ql.utils import match

from app.db import db
from app.commits.models import TFSummaryLog
from adapters.tf_summary_adapter import TFSummaryAdapter


def select_tf_summary_scalars(tags, expression: Optional[Expression] = None):
    # Search
    runs = []

    params = {}
    scalars_models = db.session.query(TFSummaryLog).all()
    for scalar in scalars_models:
        params[scalar.log_path] = scalar.params_json

    if expression is not None:
        log_paths = []
        for scalar in scalars_models:
            fields = {
                'params': params[scalar.log_path],
                'context': None,
            }
            if match(False, expression, fields):
                log_paths.append(scalar.log_path)
    else:
        log_paths = TFSummaryAdapter.list_log_dir_paths()

    # Get scalar paths
    for log_path in log_paths:
        tf = TFSummaryAdapter(log_path)
        dir_scalars = tf.get_scalars(tags)
        if dir_scalars and len(dir_scalars) > 0:
            runs.append({
                'name': log_path,
                'run_hash': TFSummaryAdapter.name_to_hash(log_path),
                'experiment_name': None,
                'metrics': dir_scalars,
                'params': params.get(log_path) or {},
                'source': 'tf_summary',
            })

    return runs


def scale_trace_steps(max_metric_len, max_steps):
    scaled_steps_len = max_steps
    if scaled_steps_len > max_metric_len:
        scaled_steps_len = max_metric_len
    if scaled_steps_len:
        scaled_steps = slice(0, max_metric_len,
                             max_metric_len // scaled_steps_len)
    else:
        scaled_steps = slice(0, 0)
    return scaled_steps


def separate_select_statement(select: list) -> tuple:
    aim_select = []
    tf_select = []

    for s in select:
        if s.startswith('tf:'):
            adapter, _, name = s.partition(':')
            tf_select.append(name)
        else:
            aim_select.append(s)

    return aim_select, tf_select


def is_tf_run(run) -> bool:
    return isinstance(run, dict) and run.get('source') == 'tf_summary'
