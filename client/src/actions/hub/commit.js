import * as actionTypes from '../actionTypes';
import callApi from '../../services/api';


export function getCommitsMetricsByQuery(query) {
  return dispatch => {
    return new Promise((resolve, reject) => {
      callApi('Commit.getCommitsMetricsByQuery', { query }).then((data) => {
        resolve(data);
      }).catch((err) => {
        reject(err);
      });
    });
  }
}

export function getCommitsDictionariesByQuery(query) {
  return dispatch => {
    return new Promise((resolve, reject) => {
      callApi('Commit.getCommitsDictionariesByQuery', { query }).then((data) => {
        resolve(data);
      }).catch((err) => {
        reject(err);
      });
    });
  }
}

export function getCommitTags(commit_id) {
  return dispatch => {
    return new Promise((resolve, reject) => {
      callApi('Commit.getCommitTags', { commit_id }).then((data) => {
        resolve(data);
      }).catch((err) => {
        reject(err);
      });
    });
  }
}

export function updateCommitTag(params) {
  return dispatch => {
    return new Promise((resolve, reject) => {
      callApi('Commit.updateCommitTag', params).then((data) => {
        resolve(data);
      }).catch((err) => {
        reject(err);
      });
    });
  }
}

export function getCommitInfo(experiment, commit_id) {
  return dispatch => {
    return new Promise((resolve, reject) => {
      callApi('Commit.getCommitInfo', { experiment, commit_id }).then((data) => {
        resolve(data);
      }).catch((err) => {
        reject(err);
      });
    });
  }
}

export function getTFSummaryList() {
  return dispatch => {
    return new Promise((resolve, reject) => {
      callApi('Commit.getTFSummaryList').then((data) => {
        resolve(data);
      }).catch((err) => {
        reject(err);
      });
    });
  }
}

export function getTFLogParams(path) {
  return dispatch => {
    return new Promise((resolve, reject) => {
      callApi('Commit.getTFLogParams', { path }).then((data) => {
        resolve(data);
      }).catch((err) => {
        reject(err);
      });
    });
  }
}

export function postTFLogParams(path, params, parsed_params) {
  return dispatch => {
    return new Promise((resolve, reject) => {
      callApi('Commit.postTFLogParams', { path, params, parsed_params }).then((data) => {
        resolve(data);
      }).catch((err) => {
        reject(err);
      });
    });
  }
}