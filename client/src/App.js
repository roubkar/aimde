import './App.less';

import React from 'react';
import Helmet from 'react-helmet';
import { BrowserRouter, Route, Switch, Redirect } from 'react-router-dom';
import LoadingBar from 'react-top-loading-bar';

import * as screens from './constants/screens';
import * as classes from './constants/classes';
import * as storeUtils from './storeUtils';
import * as cookies from './services/cookie';
import * as configs from './config';
import { isDev } from './utils';
import HubExperimentScreen from './screens/hub/HubExperimentScreen/HubExperimentScreen';
import SiteNotFoundScreen from './screens/site/SiteNotFoundScreen/SiteNotFoundScreen';
import Header from './components/global/Header/Header';
import HubMainScreen from './screens/hub/HubMainScreen/HubMainScreen';
import HubExecutablesScreen from './screens/hub/HubExecutablesScreen/HubExecutablesScreen';
import HubExecutableCreateScreen from './screens/hub/HubExecutableCreateScreen/HubExecutableCreateScreen';
import HubExecutableDetailScreen from './screens/hub/HubExecutableDetailScreen/HubExecutableDetailScreen';
import HubExecutableProcessDetailScreen from './screens/hub/HubExecutableProcessDetailScreen/HubExecutableProcessDetailScreen';
import HubTagsScreen from './screens/hub/HubTagsScreen/HubTagsScreen';
import HubTagCreateScreen from './screens/hub/HubTagCreateScreen/HubTagCreateScreen';
import HubTagDetailScreen from './screens/hub/HubTagDetailScreen/HubTagDetailScreen';
import AnalyticsPermission from './components/global/AnalyticsPermission/AnalyticsPermission';
import HubTFSummaryListScreen from './screens/hub/HubTFSummaryListScreen/HubTFSummaryListScreen';


class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      isLoading: false,
    };

    this.GAAnalytics = 'UA-154934260-2';
  }

  componentWillMount() {
    this.props.resetProgress();
  }

  componentDidMount() {
    setTimeout(() => this.props.completeProgress(), 150);
    this.props.getProject().then(() => {
      this.props.incProgress();
    });
    this.setAnalytics();
  }

  canSetAnalytics = () => {
    return !isDev() && cookies.getCookie(configs.USER_ANALYTICS_COOKIE_NAME) == 1;
  };

  setAnalytics = () => {
    if (!this.canSetAnalytics()) {
      return;
    }

    // GA
    window.dataLayer = window.dataLayer || [];
    function gtag(){window.dataLayer.push(arguments)}
    gtag('js', new Date());
    gtag('config', this.GAAnalytics);
  };

  _renderAnalytics = () => {
    if (!this.canSetAnalytics()) {
      return null;
    }

    return (
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${this.GAAnalytics}`} />
    )
  };

  render() {
    return (
      <BrowserRouter>
        <div className='LoadingBar__wrapper'>
          <LoadingBar
            height={3}
            color='#3B5896'
            progress={this.props.loadProgress}
            className='LoadingBar'
          />
        </div>
        <Header />
        {!isDev() &&
          <>
            <AnalyticsPermission />
            <Helmet>
              {this._renderAnalytics()}
            </Helmet>
          </>
        }
        <Switch>
          <Route exact path={screens.MAIN} component={HubMainScreen}/>
          <Route exact path={screens.MAIN_SEARCH} component={HubMainScreen}/>
          <Route exact path={screens.HUB_PROJECT_EXECUTABLES} component={HubExecutablesScreen}/>
          <Route exact path={screens.HUB_PROJECT_EXECUTABLE_PROCESS_DETAIL} component={HubExecutableProcessDetailScreen}/>
          <Route exact path={screens.HUB_PROJECT_CREATE_EXECUTABLE} component={HubExecutableCreateScreen}/>
          <Route exact path={screens.HUB_PROJECT_EXECUTABLE_DETAIL} component={HubExecutableDetailScreen}/>
          <Route exact path={screens.HUB_PROJECT_TAGS} component={HubTagsScreen}/>
          <Route exact path={screens.HUB_PROJECT_CREATE_TAG} component={HubTagCreateScreen}/>
          <Route exact path={screens.HUB_PROJECT_EDIT_TAG} component={HubTagDetailScreen}/>
          <Route exact path={screens.HUB_TF_SUMMARY_LIST} component={HubTFSummaryListScreen}/>
          <Route exact path={screens.HUB_PROJECT_EXPERIMENT} component={HubExperimentScreen}/>
          <Route component={SiteNotFoundScreen}/>
        </Switch>
      </BrowserRouter>
    )
  }
}

function RedirectToDefaultExperiment() {
  return (
    <Redirect to={screens.HUB_PROJECT_EXPERIMENT_DEFAULT} />
  )
}

export default storeUtils.getWithState(
  classes.APP,
  App
);