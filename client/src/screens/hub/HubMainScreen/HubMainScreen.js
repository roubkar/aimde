import './HubMainScreen.less';

import React from 'react';
import { Helmet } from 'react-helmet';
import { withRouter } from 'react-router-dom';

import ProjectWrapper from '../../../wrappers/hub/ProjectWrapper/ProjectWrapper';
import * as classes from '../../../constants/classes';
import * as screens from '../../../constants/screens';
import * as storeUtils from '../../../storeUtils';
import HubMainScreenContext from './HubMainScreenContext/HubMainScreenContext';
import { setItem, getItem } from '../../../services/storage';
import { USER_LAST_SEARCH_QUERY } from '../../../config';
import Panel from './components/Panel/Panel';
import SearchBar from './components/SearchBar/SearchBar';
import ContextBox from './components/ContextBox/ContextBox';
import ControlsSidebar from './components/ControlsSidebar/ControlsSidebar';
import { randomStr, sortOnKeys, buildUrl, getObjectValueByPath } from '../../../utils';


class HubMainScreen extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      height: 0,
      width: 0,

      // Context state
      context: {
        // Chart config
        chart: {
          focused: {
            index: null,
            metric: {
              hash: null,
              index: null,
            },
            circle: {
              active: false,
              metricIndex: null,
              stepIndex: null,
            },
          },
          settings: {
            yScale: 0,
          },
        },

        // Chart data(metrics)
        metrics: {
          isLoading: false,
          isEmpty: true,
          data: [],
        },

        // Context data(params)
        params: {
          isLoading: false,
          isEmpty: true,
          unionNamespaces: [],
          unionFields: {},
          data: {},
        },

        // Search
        search: {
          query: undefined,
        },
        searchInput: {
          value: undefined,
        },

        // Unique key to re-render svg on chart or runs states update
        key: null,
      },
    };

    this.projectWrapperRef = React.createRef();
    this.panelRef = React.createRef();

    this.URLStateParams = [
      'chart.focused.circle',
      'chart.settings',
      'search',
    ];

    this.defaultSearchQuery = 'metric:loss';
  }

  componentWillMount() {
    this.props.resetProgress();
    this.unBindURLChangeListener = this.props.history.listen((location) => {
      this.recoverStateFromURL(location.search);
    });
  }

  componentDidUpdate() {
    if (!!this.panelRef.current && this.state.context.key !== this.panelRef.current.key) {
      this.panelRef.current.renderChart();
    }
  }

  componentDidMount() {
    this.props.completeProgress();
    this.updateWindowDimensions();
    window.addEventListener('resize', () => this.updateWindowDimensions());
    this.recoverStateFromURL(window.location.search);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', () => this.updateWindowDimensions());
    this.unBindURLChangeListener();
  }

  updateWindowDimensions = () => {
    const wrapper = this.projectWrapperRef.current;
    const projectWrapperHeight = wrapper ? this.projectWrapperRef.current.getHeaderHeight() : null;
    if (projectWrapperHeight) {
      this.setState({
        height: window.innerHeight - projectWrapperHeight - 1,
        width: window.innerWidth,
      });
    } else {
      setTimeout(() => this.updateWindowDimensions(), 25);
    }
  };

  recoverStateFromURL = (search) => {
    if (!!search && search.indexOf('?search=') !== -1) {
      if (!this.isURLStateOutdated(search)) {
        return;
      }

      const state = this.URLSearchToState(search);
      //   if (this.state.context.search.query === undefined && state.search.query === undefined) {
      //     state.search.query = this.defaultSearchQuery;
      //   }

      if (JSON.stringify(state.search) !== JSON.stringify(this.state.context.search)) {
        this.setSearchState(state.search, () => {
          this.searchByQuery(false).then(() => {
            this.setChartFocusedState(state.chart.focused, null, false);
            this.setChartSettingsState(state.chart.settings, null, false);
          });
        }, false);
      } else {
        this.setChartFocusedState(state.chart.focused, null, false);
        this.setChartSettingsState(state.chart.settings, null, false);
      }
    } else {
      let setSearchQuery = getItem(USER_LAST_SEARCH_QUERY);
      if (!setSearchQuery) {
        setSearchQuery = this.defaultSearchQuery;
      }
      if (!!setSearchQuery) {
        this.setSearchState({
          query: setSearchQuery,
        }, () => {
          this.searchByQuery().then(() => {});
        }, true);
      }
    }
  };

  stateToURL = (state) => {
    const encodedState = btoa(JSON.stringify(state));
    const URL = buildUrl(screens.MAIN_SEARCH, {
      search: encodedState,
    });
    return URL;
  };

  URLSearchToState = (search) => {
    if (search.indexOf('?search=') !== -1) {
      const encodedState = search.substr(8);
      return JSON.parse(atob(encodedState));
    }
    return null;
  };

  isURLStateOutdated = (searchQuery) => {
    const state = this.URLSearchToState(searchQuery);
    if (state === null) {
      return !(!!searchQuery && searchQuery.indexOf('?search=') !== -1);
    }

    for (let p in this.URLStateParams) {
      if (JSON.stringify(getObjectValueByPath(state, this.URLStateParams[p]))
        !== JSON.stringify(getObjectValueByPath(this.state.context, this.URLStateParams[p]))) {
        return true;
      }
    }
    return false;
  };

  updateURL = () => {
    if (!this.isURLStateOutdated(window.location.search)) {
      return;
    }

    const state = {
      chart: {
        settings: this.state.context.chart.settings,
        focused: {
          circle: this.state.context.chart.focused.circle,
        },
      },
      search: {
        query: this.state.context.search.query,
      },
    };

    const URL = this.stateToURL(state);
    if (window.location.pathname + window.location.search !== URL) {
      console.log('Update: URL');
      this.props.history.push(URL);
      if (state.search.query !== null) {
        setItem(USER_LAST_SEARCH_QUERY, state.search.query);
      }
    }
  };

  reRenderChart = () => {
    this.setState(prevState => ({
      ...prevState,
      context: {
        ...prevState.context,
        key: randomStr(16),
      },
    }));
  };

  setMetricsState = (metricsState, callback=null) => {
    this.setState(prevState => ({
      ...prevState,
      context: {
        ...prevState.context,
        metrics: {
          ...prevState.context.metrics,
          ...metricsState,
        },
      },
    }), () => {
      if (callback !== null) {
        callback();
      }
      this.reRenderChart();
    });
  };

  setParamsState = (paramsState, callback=null) => {
    this.setState(prevState => ({
      ...prevState,
      context: {
        ...prevState.context,
        params: {
          ...prevState.context.params,
          ...paramsState,
        },
      },
    }), () => {
      if (callback !== null) {
        callback();
      }
    });
  };

  setSearchState = (searchState, callback=null, updateURL=true) => {
    this.setState(prevState => ({
      ...prevState,
      context: {
        ...prevState.context,
        search: {
          ...prevState.context.search,
          ...searchState,
        },
        searchInput: {
          ...prevState.context.searchInput,
          value: searchState.query || prevState.context.searchInput.value,
        },
      },
    }), () => {
      if (callback !== null) {
        callback();
      }
      if (updateURL) {
        this.updateURL();
      }
    });
  };

  setSearchInputValue = (value, callback=null) => {
    this.setState(prevState => ({
      ...prevState,
      context: {
        ...prevState.context,
        searchInput: {
          ...prevState.context.searchInput,
          value,
        },
      },
    }), () => {
      if (callback !== null) {
        callback();
      }
    });
  };

  setChartState = (chartState, callback=null, updateURL) => {
    this.setState(prevState => {
      const chartStateUpd = Object.assign({}, prevState.context.chart, chartState);
      const contextState = Object.assign({}, prevState.context, {
        chart: chartStateUpd,
      });
      return Object.assign({}, prevState, {
        context: contextState,
      });
    }, () => {
      this.reRenderChart();
      if (callback !== null) {
        callback();
      }
      if (updateURL) {
        this.updateURL();
      }
    });
  };

  setChartSettingsState = (settingsState, callback=null, updateURL=true) => {
    this.setChartState({
      // FIXME: Not pass current state value
      settings: {
        ...this.state.context.chart.settings,
        ...settingsState,
      },
    }, callback, updateURL);
  };

  setChartFocusedState = (focusedState, callback=null, updateURL=true) => {
    this.setChartState({
      // FIXME: Not pass current state value
      focused: {
        ...this.state.context.chart.focused,
        ...focusedState,
      },
    }, callback, updateURL);
  };

  getMetricsByQuery = (query) => {
    return new Promise(resolve => {
      this.setMetricsState({ isLoading: true });
      this.props.getCommitsMetricsByQuery(query).then((data) => {
        this.setMetricsState({
          isEmpty: !data || Object.values(data).length === 0,
          data: data,
        }, resolve);
      }).finally(() => {
        this.setMetricsState({ isLoading: false });
      });
    });
  };

  getParamsByQuery = (query) => {
    return new Promise(resolve => {
      this.setParamsState({ isLoading: true });

      this.props.getCommitsDictionariesByQuery(query).then((data) => {
        let unionNamespaces = [];
        let unionFields = {};

        for (let i in data) {
          if (!!data[i].data && Object.keys(data[i].data).length) {
            unionNamespaces = unionNamespaces.concat(...Object.keys(data[i].data));
          }
        }
        unionNamespaces = Array.from(new Set(unionNamespaces));

        if (unionNamespaces.length) {
          for (let n in unionNamespaces) {
            unionFields[unionNamespaces[n]] = [];
          }
          for (let i in data) {
            Object.keys(data[i].data).forEach(n => {
              unionFields[n] = unionFields[n].concat(...Object.keys(data[i].data[n]));
            });
          }
          for (let n in unionNamespaces) {
            unionFields[unionNamespaces[n]] = Array.from(new Set(unionFields[unionNamespaces[n]])).sort();
          }
        }
        unionFields = sortOnKeys(unionFields);

        this.setParamsState({
          isEmpty: !unionNamespaces || unionNamespaces.length === 0,
          unionNamespaces,
          unionFields,
          data: data,
        }, resolve);
      }).finally(() => {
        this.setParamsState({ isLoading: false });
      });
    });
  };

  getTFSummaryScalars = () => {
    return this.state.context.metrics.data.filter(m => m.source !== undefined && m.source === 'tf_summary');
  };

  isAimRun = (lineData) => {
    // Returns `true` if run is tracked via Aim(not loaded from tf summary)
    return lineData['source'] === undefined;
  };

  isTFSummaryScalar = (lineData) => {
    // Returns `true` if run is imported from TF summary
    return lineData['source'] === 'tf_summary';
  };

  searchByQuery = (updateURL) => {
    return new Promise(resolve => {
      const query = this.state.context.search.query.trim();
      this.setChartFocusedState({
        index: null,
        metric: {
          hash: null,
          index: null,
        },
        circle: {
          metricIndex: null,
          stepIndex: null,
        },
      }, () => {
        Promise.all([
          this.getMetricsByQuery(query),
          this.getParamsByQuery(query),
        ]).then(() => {
          resolve();
        });
      }, updateURL);
    });
  };

  getMetricByHash = (hash) => {
    for (let i in this.state.context.metrics.data) {
      if (this.state.context.metrics.data[i].hash === hash) {
        return this.state.context.metrics.data[i];
      }
    }
    return null;
  };

  getMetricStepValueByStepIdx = (metricData, stepIdx) => {
    const item = this.getMetricStepDataByStepIdx(metricData, stepIdx);
    return item ? item.value : null;
  };

  getMetricStepDataByStepIdx = (metricData, stepIdx) => {
    for (let i = 0; i < metricData.length; i++) {
      if (metricData[i].step === stepIdx) {
        return metricData[i];
      } else if (metricData[i].step > stepIdx) {
        return null;
      }
    }

    return null;
  };

  hashToColor = (hash, alpha=1) => {
    const index = hash.split('').map((c, i) => hash.charCodeAt(i)).reduce((a, b) => a + b);
    const r = 50;
    const g = ( index * 27 ) % 255;
    const b = ( index * 13 ) % 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  getMetricColor = (metric, alpha=1) => {
    if (metric.tag && metric.tag.color) {
      return metric.tag.color;
    }

    return this.hashToColor(metric.hash, alpha);
  };

  _renderContent = () => {
    const headerWidth = 70;
    const controlsWidth = 75;

    return (
      <div
        className='HubMainScreen__wrapper'
        style={{
          height: this.state.height,
        }}
      >
        <div className='HubMainScreen'>
          <div className='HubMainScreen__grid'>
            <div className='HubMainScreen__grid__body'>
              <div className='HubMainScreen__grid__search'>
                <SearchBar />
              </div>
              <div className='HubMainScreen__grid__panel'>
                <Panel ref={this.panelRef} />
              </div>
              <div className='HubMainScreen__grid__context'>
                <ContextBox
                  width={this.state.width - headerWidth - controlsWidth - 10}
                />
              </div>
            </div>
            <div className='HubMainScreen__grid__controls'>
              <ControlsSidebar />
            </div>
          </div>
        </div>
      </div>
    );
  };

  render() {
    return (
      <ProjectWrapper
        size='fluid'
        gap={false}
        ref={this.projectWrapperRef}
      >
        <Helmet>
          <meta title='' content='' />
        </Helmet>

        <HubMainScreenContext.Provider
          value={{
            // Pass state
            ...this.state.context,

            // Pass methods
            updateURL                   : this.updateURL,
            setChartSettingsState       : this.setChartSettingsState,
            setChartFocusedState        : this.setChartFocusedState,
            setSearchState              : this.setSearchState,
            setSearchInputValue         : this.setSearchInputValue,
            setMetricsState             : this.setMetricsState,
            searchByQuery               : this.searchByQuery,
            getMetricByHash             : this.getMetricByHash,
            getMetricStepValueByStepIdx : this.getMetricStepValueByStepIdx,
            getMetricStepDataByStepIdx  : this.getMetricStepDataByStepIdx,
            getTFSummaryScalars         : this.getTFSummaryScalars,
            isAimRun                    : this.isAimRun,
            isTFSummaryScalar           : this.isTFSummaryScalar,
            hashToColor                 : this.hashToColor,
            getMetricColor              : this.getMetricColor,
          }}
        >
          {this._renderContent()}
        </HubMainScreenContext.Provider>
      </ProjectWrapper>
    )
  }
}

export default withRouter(storeUtils.getWithState(
  classes.HUB_MAIN_SCREEN,
  HubMainScreen
));