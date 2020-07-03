import './HubMainScreen.less';

import React from 'react';
import { Helmet } from 'react-helmet';

import ProjectWrapper from '../../../wrappers/hub/ProjectWrapper/ProjectWrapper';
import * as classes from '../../../constants/classes';
import * as storeUtils from '../../../storeUtils';
import HubMainScreenProvider from './HubMainScreenProvider/HubMainScreenProvider';
import Panel from './components/Panel/Panel';
import SearchBar from './components/SearchBar/SearchBar';
import ContextBox from './components/ContextBox/ContextBox';
import ControlsSidebar from './components/ControlsSidebar/ControlsSidebar';


class HubMainScreen extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      height: 0,
    };

    this.projectWrapperRef = React.createRef();
    this.panelRef = React.createRef();
  }

  componentWillMount() {
    this.props.resetProgress();
  }

  componentDidMount() {
    this.props.completeProgress();
    this.updateWindowDimensions();
    window.addEventListener('resize', () => this.updateWindowDimensions());
  }

  componentWillUnmount() {
    window.removeEventListener('resize', () => this.updateWindowDimensions());
  }

  updateWindowDimensions = () => {
    const wrapper = this.projectWrapperRef.current;
    const projectWrapperHeight = wrapper ? this.projectWrapperRef.current.getHeaderHeight() : null;
    if (projectWrapperHeight) {
      this.setState({
        height: window.innerHeight - projectWrapperHeight - 1,
      });
    } else {
      setTimeout(() => this.updateWindowDimensions(), 25);
    }
  };

  dataDidUpdate = () => {
    this.panelRef.current.dataDidUpdate();
  };

  _renderContent = () => {
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
                <ContextBox />
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

        <HubMainScreenProvider
          dataDidUpdate={() => this.dataDidUpdate()}
        >
          {this._renderContent()}
        </HubMainScreenProvider>
      </ProjectWrapper>
    )
  }
}

export default storeUtils.getWithState(
  classes.HUB_MAIN_SCREEN,
  HubMainScreen
);