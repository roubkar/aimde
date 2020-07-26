import os

from app.commits.utils import TFSummaryAdapter


class Project:
    DEFAULT_PROJECT_NAME = 'Project'
    DEFAULT_PROJECT_PATH = '/project'

    def __init__(self):
        self.name = os.getenv('PROJECT_NAME') or self.DEFAULT_PROJECT_NAME
        self.path = os.getenv('PROJECT_PATH') or self.DEFAULT_PROJECT_PATH
        self.description = ''
        self.tf_enabled = TFSummaryAdapter.exists()

    def exists(self):
        return True
