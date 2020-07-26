import './HubExperimentScreen.less';
import './ExperimentDiff.css';

import React from 'react';
import { Helmet } from 'react-helmet';
import { Redirect, Link } from 'react-router-dom';
import ReactSVG from 'react-svg';
import {parseDiff, Diff, Hunk, Decoration} from 'react-diff-view';
import moment from 'moment';

import ProjectWrapper from '../../../wrappers/hub/ProjectWrapper/ProjectWrapper';
import ExperimentCell from '../../../components/hub/ExperimentCell/ExperimentCell';
import * as classes from '../../../constants/classes';
import * as storeUtils from '../../../storeUtils';
import UI from '../../../ui';
import { buildUrl, classNames, formatDuration, formatSize } from '../../../utils';
import { SERVER_HOST, SERVER_API_HOST, WS_HOST } from '../../../config';
import * as screens from '../../../constants/screens';
import CommitNavigation from '../../../components/hub/CommitNavigation/CommitNavigation';
import IncompatibleVersion from '../../../components/global/IncompatibleVersion/IncompatibleVersion';
import CurrentRunIndicator from '../../../components/hub/CurrentRunIndicator/CurrentRunIndicator';


class HubExperimentScreen extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      isLoading: true,
      notFound: false,
      versionError: false,
      experiment: null,
      selectedModel: false,
      selectBranch: null,
      commits: [],
      commit: {},
      contentWidth: null,
      metricsData: {},
      tags: [],
      tagsAreLoading: true,
    };

    this.contentRef = React.createRef();

    this.WSClient = null;
  }

  componentWillMount() {
    this.props.resetProgress();
  }

  componentDidMount() {
    this.getExperiment();
    this.getTags();
    this.handleResize();
    window.addEventListener('resize', this.handleResize);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handleResize);
  }

  componentWillReceiveProps(props) {
    if (props.location.pathname !== this.props.location.pathname) {
      this.WSClose();
      this.setState({
        isLoading: true,
        notFound: false,
        experiment: null,
        annotations: null,
        expandCluster: {},
        selectedModel: false,
        selectBranch: null,
        tags: [],
      }, () => {
        this.getExperiment();
        this.getTags();
      });
    }
  }

  getTags = () => {
    this.setState(prevState => ({
      ...prevState,
      tagsAreLoading: true,
    }));

    this.props.getCommitTags(this.props.match.params.commit_id).then(data => {
      this.setState({
        tags: data,
      })
    }).catch((err) => {
    }).finally(() => {
      this.setState(prevState => ({
        ...prevState,
        tagsAreLoading: false,
      }));
    })
  };

  onIndex = () => {
    return this.props.match.params.commit_id === 'index';
  };

  WSOpen = () => {
    if (!this.WSClient && this.onIndex()) {
      this.WSClient = new WebSocket(`${WS_HOST}/insight`);
      this.WSClient.onopen = this.WSOnOpen;
      this.WSClient.onerror = this.WSOnError;
      this.WSClient.onmessage = this.WSOnMessage;
    }
  };

  WSClose = () => {
    if (this.WSClient) {
      this.WSClient.close();
      this.WSClient = null;
    }
  };

  WSOnOpen = () => {
    // Connection is opened
  };

  WSEncodeInsight = (data) => {
    const dataComplete = Object.assign({
      'branch': this.props.match.params.experiment_name,
    }, data);

    const dataJson = JSON.stringify(dataComplete);
    const dataHash = btoa(dataJson);
    return dataHash;
  };

  WSDecodeInsight = (dataHash) => {
    const dataJson = atob(dataHash);
    const data = JSON.parse(dataJson);
    return data;
  };

  WSOnError = () => {
    this.WSClient = null;
    setTimeout(() => this.WSOpen(), 1000);
  };

  WSSendMsg = (msg, wait=false) => {
    const jsonMsg = JSON.stringify(msg);

    if (this.WSClient && this.WSClient.readyState === WebSocket.OPEN) {
      this.WSClient.send(jsonMsg);
    } else {
      if (wait) {
        setTimeout(() => this.WSSendMsg(msg, wait), 50);
      }
    }
  };

  WSSubscribeToInsightUpdates = (insightHash) => {
    this.WSSendMsg({
      event: 'subscribe',
      data: insightHash,
    }, true);
  };

  WSUnsubscribeFromInsightUpdates = (insightHash) => {
    this.WSSendMsg({
      event: 'unsubscribe',
      data: insightHash,
    }, true);
  };

  WSOnMessage = (WSMsg) => {
    const msg = JSON.parse(WSMsg.data);

    switch (msg.event) {
      case 'insight_update':
        this.WSOnInsightUpdate(msg.header, msg.data);
        break
    }
  };

  WSOnInsightUpdate = (header, data) => {
    header = this.WSDecodeInsight(header);

    switch (header.insight) {
      case 'stat':
        this.updateStat(header.name, JSON.parse(data));
        break;
      case 'metric':
        this.updateMetric(header.name, data);
        break;
    }
  };

  statSubscribeToUpdates = (statName, resourceName) => {
    const insightHash = this.WSEncodeInsight({
      insight: 'stat',
      name: statName,
      resource: resourceName,
      file_path: `dirs/${statName}/${resourceName}.log`,
    });

    this.WSSubscribeToInsightUpdates(insightHash);
  };

  statUnsubscribeFromUpdates = (statName, resourceName) => {
    const insightHash = this.WSEncodeInsight({
      insight: 'stat',
      name: statName,
      resource: resourceName,
      file_path: `dirs/${statName}/${resourceName}.log`,
    });

    this.WSUnsubscribeFromInsightUpdates(insightHash);
  };

  metricSubscribeToUpdates = (metricName, format) => {
    const insightHash = this.WSEncodeInsight({
      insight: 'metric',
      name: metricName,
      format: format,
      file_path: `metrics/${metricName}.log`,
    });

    this.WSSubscribeToInsightUpdates(insightHash);
  };

  metricUnsubscribeFromUpdates = (metricName) => {
    const insightHash = this.WSEncodeInsight({
      insight: 'metric',
      name: metricName,
      file_path: `metrics/${metricName}.log`,
    });

    this.WSUnsubscribeFromInsightUpdates(insightHash);
  };

  updateMetric = (metricName, data) => {
    if (isNaN(data)) {
      return;
    }

    data = parseFloat(data);

    this.setState((prevState) => {
      let { metricsData } = prevState;

      let updatedData = [];
      if (metricsData[metricName].data && metricsData[metricName].data.length) {
        updatedData = [...metricsData[metricName].data];
      }
      updatedData.push(data);

      metricsData = Object.assign({}, metricsData, {
        [metricName]: Object.assign({}, metricsData[metricName], {
          data: updatedData,
          rerender: false,
        }),
      });

      return {
        ...prevState,
        metricsData,
      };
    });
  };

  handleResize = () => {
    if (!this.contentRef.current) {
      setTimeout(() => this.handleResize(), 50);
      return;
    }

    const width = this.contentRef.current.containerRef.current.offsetWidth;

    this.setState((prevState) => {
      return {
        ...prevState,
        contentWidth: width,
      };
    });
  };

  getExperiment = () => {
    if (this.onIndex()) {
      this.WSOpen();
    }

    let experimentName = this.props.match.params.experiment_name,
      commitId = this.props.match.params.commit_id;

    this.props.getExperiment(experimentName, commitId).then((data) => {
      let annotations = {};
      if (data.annotations) {
        data.annotations.forEach((annotationItem) => {
          let annotationCluster = {};
          annotationItem.data.forEach((item) => {
            let predLabel = item.meta.label;
            if (!(predLabel in annotationCluster)) {
              annotationCluster[predLabel] = [];
            }
            annotationCluster[predLabel].push(item);
          });
          annotations[annotationItem.name] = annotationCluster;
        });
      }

      this.props.incProgress();

      this.setState((prevState) => {
        return {
          ...prevState,
          experiment: data,
          annotations: annotations,
          commits: data.commits ? Object.values(data.commits) : [],
          commit: data.commit ? data.commit : null,
          selectedModel: !!data.models ? data.models[0] : false,
        };
      }, () => {
        if (data.metrics) {
          const metricsData = {};
          data.metrics.forEach((item) => {
            metricsData[item.name] = {
              data: item.data,
              rerender: true,
            };
            this.metricSubscribeToUpdates(item.name, item.format);
          });
          this.setState({ metricsData });
        }
      });
    }).catch((err) => {
      if (err.status === 501) {
        this.setState({
          versionError: true,
        });
      } else if (err.status === 404 || err.status === 500) {
        this.setState({
          notFound: true,
        });
      }
    }).finally(() => {
      this.setState((prevState) => {
        return {
          ...prevState,
          isLoading: false,
        };
      });

      setTimeout(() => this.props.completeProgress(), 300);
    });
  };

  handleModelOpen = (model) => {
    this.setState({
      selectedModel: model,
    });
  };

  handleBranchChange = (v, { action }) => {
    let experimentName = this.props.match.params.experiment_name;

    if (action === 'select-option' && v.value !== experimentName) {
      this.setState({
        selectBranch: v.value,
      });
    }
  };

  _formatFileSize = (size) => {
    let formatted = formatSize(size);
    return `${formatted[0]}${formatted[1]}`;
  };

  _renderMetric = (metric, key) => {
    const data = this.state.metricsData[metric.name].data;

    return (
      <ExperimentCell type='metric' footerTitle={metric.name} key={key * 10 + 5}>
        <UI.LineChart
          key={key}
          header={metric.name}
          data={data}
          rerender={this.state.metricsData[metric.name].rerender}
          xAxisFormat='step' />
      </ExperimentCell>
    )
  };

  _renderModel = (model, key) => {
    let className = classNames({
      ExperimentCheckpoint: true,
      active: this.state.selectedModel === model,
    });

    let experimentName = this.props.match.params.experiment_name;

    let commitId = this.state.commit.hash;

    return (
      <div className={className} key={key * 10 + 2}>
        <div className='ExperimentCheckpoint__area' onClick={() => this.handleModelOpen(model)}>
          <div className='ExperimentCheckpoint__header'>
            <UI.Text type='grey-darker' subtitle>{model.name}</UI.Text>
            <a
              href={`${SERVER_API_HOST}/projects/${experimentName}/${commitId}/models/${model.name}.aim`}
              target='_blank'
              rel='noopener noreferrer'
              download={`${model.name}`}
            >
              Download <UI.Text type='grey-light' small inline>(~{this._formatFileSize(model.size)})</UI.Text>
            </a>
          </div>
          <div className='ExperimentCheckpoint__body'>
            <UI.Text type='grey-light' small subtitle>Epoch: {model.data.epoch}</UI.Text>
          </div>
        </div>
      </div>
    )
  };

  _renderMap = (mapItem, mapKey) => {
    return (
      <>
        <ExperimentCell
          type='dictionary'
          footerTitle={mapItem.name}
          key={mapKey * 10 + 9}
          width={1}
          className='ExperimentParams'
        >
          <div className='ExperimentParams__item title' key={0}>
            <div>
              <UI.Text type='primary' overline bold>Key</UI.Text>
            </div>
            <div>
              <UI.Text type='primary' overline bold>Value</UI.Text>
            </div>
          </div>
          {Object.keys(mapItem.data).map((item, key) =>
            <div className='ExperimentParams__item' key={key}>
              <div className='ExperimentParams__item__idx'>{key+1}</div>
              <div>{item}</div>
              <div>{mapItem.data[item]}</div>
            </div>
          )}
        </ExperimentCell>
      </>
    )
  };

  _renderExperimentHeader = () => {
    let experimentName = this.props.match.params.experiment_name;

    let processDuration = null;
    if (!!this.state.commit.process && !!this.state.commit.process.time) {
      processDuration = formatDuration(this.state.commit.process.time);
    }

    return (
      <>
        {!!this.props.project.branches && !!this.props.project.branches.length &&
          <div className='HubExperimentScreen__header'>
            <UI.Dropdown
              className='HubExperimentScreen__branchSelect'
              width={200}
              options={this.props.project.branches && this.props.project.branches.map(val => ({
                value: val,
                label: `${val}`,
              }))}
              defaultValue={{
                value: experimentName,
                label: `${experimentName}`,
              }}
              onChange={this.handleBranchChange}
            />
            <div>
              {!!this.state.commit &&
              <div className='HubExperimentScreen__header__content'>
                <div className='HubExperimentScreen__header__content__process'>
                  {!!this.state.commit.process && this.state.commit.process.finish === false &&
                    <CurrentRunIndicator />
                  }
                  {this.state.commit.process &&
                    <div>
                      {!!this.state.commit.process.start_date &&
                        <UI.Text
                          type='grey'
                          small
                        >
                          {!!this.state.commit.process.uuid
                            ? <Link to={buildUrl(screens.HUB_PROJECT_EXECUTABLE_PROCESS_DETAIL, {
                              process_id: this.state.commit.process.uuid,
                            })}>
                              Process
                            </Link>
                            : <UI.Text inline>Process</UI.Text>
                          }
                          {' '} started at {moment.unix(this.state.commit.process.start_date).format('D MMM, YY')}
                        </UI.Text>
                      }
                      {!!processDuration &&
                        <UI.Text
                          type='grey'
                          small
                        >
                          Execution Time:
                          {` ${processDuration.hours}h ${processDuration.minutes}m ${processDuration.seconds}s`}
                        </UI.Text>
                      }
                    </div>
                  }
                </div>
                {!this.state.tagsAreLoading && this.state.tags.length > 0 &&
                  <div className='HubExperimentScreen__header__tags'>
                    {this.state.tags.map((tag) => (
                      <Link to={buildUrl(screens.HUB_PROJECT_EDIT_TAG, {
                        tag_id: tag.id,
                      })}>
                        <UI.Label
                          key={tag.id}
                          color={tag.color}
                        >
                          {tag.name}
                        </UI.Label>
                      </Link>
                    ))}
                  </div>
                }
              </div>
              }
            </div>
          </div>
        }
      </>
    )
  };

  _renderEmptyBranch = () => {
    let experimentName = this.props.match.params.experiment_name;

    return (
      <>
        {this._renderExperimentHeader()}
        <div className='HubExperimentScreen__empty'>
          <ReactSVG
            className='HubExperimentScreen__empty__illustration'
            src={require('../../../asset/illustrations/no_data.svg')}
          />
          <UI.Text size={6} type='grey-light' center>
            Experiment "{experimentName}" is empty
          </UI.Text>
        </div>
      </>
    )
  };

  _renderEmptyIndex = () => {
    return (
      <>
        {this._renderExperimentHeader()}
        <div className='HubExperimentScreen__empty'>
          <ReactSVG
            className='HubExperimentScreen__empty__illustration'
            src={require('../../../asset/illustrations/no_data.svg')}
          />
          <UI.Text size={6} type='grey-light' center>
            Nothing to show — empty run
          </UI.Text>
        </div>
      </>
    )
  };

  _renderNavigation = () => {
    if (!this.state.experiment || !this.state.experiment.init || !this.state.experiment.branch_init) {
      return null;
    }

    const experimentName = this.props.match.params.experiment_name;

    return (
      <CommitNavigation
        commits={this.state.commits}
        active={this.state.commit.hash}
        experimentName={experimentName}
      />
    )
  };

  _renderContent = () => {
    let selectedModel = this.state.selectedModel;

    if (this.state.versionError) {
      return (
        <IncompatibleVersion />
      )
    }

    if (!this.state.experiment || !this.state.experiment.branch_init) {
      return this._renderEmptyBranch();
    }

    if (this.state.experiment.index_empty
      || (!this.state.experiment.maps.length && !this.state.experiment.metrics.length
          && !this.state.experiment.models.length)
    ) {
      return this._renderEmptyIndex();
    }

    return (
      <>
        {this._renderExperimentHeader()}
        <div className='HubExperimentScreen__grid'>
          <div className='HubExperimentScreen__grid__wrapper'>
            {this.state.experiment.maps.map((mapItem, mapKey) =>
              <>
                {mapItem.nested
                  ? ( 
                    Object.keys(mapItem.data).map((mapItemKeyName, mapItemKey) =>
                      this._renderMap({
                        data: mapItem.data[mapItemKeyName],
                        name: `${mapItemKeyName}`,
                      }, `${mapItemKeyName}-${mapItemKey}`)
                    )
                  )
                  : this._renderMap(mapItem, mapKey)
                }
              </>
            )}
            {this.state.experiment.metrics.map((item, key) =>
              this._renderMetric(item, key)
            )}
            {!!this.state.experiment.models.length &&
              <ExperimentCell
                type='model'
                footerTitle={this.state.experiment.models[0].data.name}
                height='auto'
                width={2}
              >
                <div className='ExperimentModel__body'>
                  <div className='ExperimentModel__list'>
                    {Object.keys(this.state.experiment.models).map((itemKey, key) =>
                      this._renderModel(this.state.experiment.models[itemKey], key)
                    )}
                  </div>
                  <div className='ExperimentModel__detail'>
                    {!selectedModel &&
                    <div className='ExperimentModel__detail__default'>
                      <UI.Text type='grey-light' size={6}>
                        Select a model
                        <br />
                        from left menu
                      </UI.Text>
                    </div>
                    }
                    {!!selectedModel &&
                    <div className='ExperimentModel__detail__item'>
                      <UI.Text type='grey-dark' divided spacing>{selectedModel.name}</UI.Text>
                      {!!selectedModel.data.meta &&
                      <>
                        {Object.keys(selectedModel.data.meta).map((item, key) =>
                          <UI.Text key={key} type='grey'>{item}: {selectedModel.data.meta[item]}</UI.Text>
                        )}
                      </>
                      }
                    </div>
                    }
                  </div>
                </div>
              </ExperimentCell>
            }
          </div>
        </div>
      </>
    )
  };

  render() {
    let experimentName = this.props.match.params.experiment_name;

    if (this.state.isLoading) {
      return null;
    }

    if (this.state.notFound) {
      return (
        <Redirect to={screens.NOT_FOUND} />
      )
    }

    if (this.state.selectBranch) {
      return (
        <Redirect to={buildUrl(screens.HUB_PROJECT_EXPERIMENT, {
          experiment_name: this.state.selectBranch,
          commit_id: 'latest',
        })} />
      )
    }

    return (
      <ProjectWrapper
        experimentName={experimentName}
        navigation={this._renderNavigation()}
        contentWidth={this.state.contentWidth}
      >
        <Helmet>
          <meta title='' content='' />
        </Helmet>

        <UI.Container size='small' ref={this.contentRef}>
          {this._renderContent()}
        </UI.Container>
      </ProjectWrapper>
    )
  }
}

export default storeUtils.getWithState(
  classes.HUB_PROJECT_EXPERIMENT_SCREEN,
  HubExperimentScreen
);
