import './ControlsSidebar.less';

import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { classNames } from '../../../../../utils';
import UI from '../../../../../ui';
import HubMainScreenContext from '../../HubMainScreenContext/HubMainScreenContext';
import ControlsSidebarExport from './components/ControlsSidebarExport/ControlsSidebarExport';


class ControlsSidebar extends Component {
  constructor(props) {
    super(props);

    this.state = {
      activeMenu: null,
      activeItem: null,
    };
  }

  componentDidMount() {
    window.addEventListener('click', this.handleWindowClick);
  }

  componentWillUnmount() {
    window.removeEventListener('click', this.handleWindowClick);
  }

  handleWindowClick = () => {
    this.setState({
      activeMenu: null,
      activeItem: null,
    });
  };

  handleControlClick = (e, name) => {
    e.stopPropagation();
    this.setState({
      activeMenu: name,
      activeItem: name,
    });
  };

  handleMenuClick = (e) => {
    e.stopPropagation();
  };

  handleYScaleChange = (yScale) => {
    this.context.setChartSettingsState({ 'yScale': yScale });
  };

  render() {
    return (
      <div className='ControlsSidebar'>
        <div className='ControlsSidebar__items'>
          <div className='ControlsSidebar__item__wrapper'>
            <div
              className={classNames({
                ControlsSidebar__item: true,
                active: this.state.activeItem === 'yScale',
              })}
              onClick={(e) => this.handleControlClick(e, 'yScale')}
            >
              <UI.Icon i='nc-settings-gear-63' scale={1.4} />
            </div>
            <div
              className={classNames({
                ControlsSidebar__menu: true,
                open: this.state.activeMenu === 'yScale',
              })}
              onClick={(e) => this.handleMenuClick(e)}
            >
              <div className='ControlsSidebar__menu__list'>
                <div className='ControlsSidebar__menu__list__header'>
                  <UI.Text overline bold>Scale Y axis</UI.Text>
                </div>
                <div className='ControlsSidebar__menu__list__items'>
                  <div
                    className='ControlsSidebar__menu__item'
                    onClick={() => this.handleYScaleChange(0)}
                  >
                    Linear
                  </div>
                  <div
                    className='ControlsSidebar__menu__item'
                    onClick={() => this.handleYScaleChange(1)}
                  >
                    Log
                  </div>
                </div>
              </div>
            </div>
          </div>
          <ControlsSidebarExport />
        </div>
      </div>
    );
  }
}

ControlsSidebar.propTypes = {};

ControlsSidebar.contextType = HubMainScreenContext;

export default ControlsSidebar;