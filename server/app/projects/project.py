import os

from aim.engine.repo import AimRepo

from app.commits.utils import TFSummaryAdapter


class Project:
    DEFAULT_PROJECT_NAME = 'Project'
    DEFAULT_PROJECT_PATH = '/project'
    REPO_PATH = '/store'

    def __init__(self):
        self.name = os.getenv('PROJECT_NAME') or self.DEFAULT_PROJECT_NAME
        self.path = os.getenv('PROJECT_PATH') or self.DEFAULT_PROJECT_PATH
        self.description = ''
        self.tf_enabled = TFSummaryAdapter.exists()
        self.repo = AimRepo(repo_full_path=self.REPO_PATH,
                            mode=AimRepo.READING_MODE)

    def exists(self):
        return self.repo and self.repo.exists()
