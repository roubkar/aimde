import React, { useState, useEffect } from 'react';
import { classNames } from '../../../../../../../utils';

import PropTypes from 'prop-types';

function ControlsSidebarYScale(props) {
  let [state, setState] = useState({
    activeMenu: null,
    activeItem: null,
  });

  useEffect(() => {
    window.addEventListener('click', this.handleWindowClick);
    return () => {
      window.removeEventListener('click', this.handleWindowClick);
    }
  }, []);

  handleWindowClick = () => {
    setState({
      activeMenu: null,
      activeItem: null,
    });
  };

  handleControlClick = (e, name) => {
    e.stopPropagation();
    setState({
      activeMenu: name,
      activeItem: name,
    });
  };

  handleMenuClick = (e) => {
    e.stopPropagation();
  };

  handleYScaleChange = (yScale) => {
    props.setChartSettingsState({ 'yScale': yScale });
  };

  return (
    <div className='ControlsSidebar__item__wrapper'>
      <div
        className={classNames({
          ControlsSidebar__item: true,
          active: state.activeItem === 'yScale',
        })}
        onClick={(e) => handleControlClick(e, 'yScale')}
      >
        <UI.Icon i='nc-settings-gear-63' scale={1.4} />
      </div>
      <div
        className={classNames({
          ControlsSidebar__menu: true,
          open: state.activeMenu === 'yScale',
        })}
        onClick={(e) => handleMenuClick(e)}
      >
        <div className='ControlsSidebar__menu__list'>
          <div className='ControlsSidebar__menu__list__header'>
            <UI.Text overline bold>Scale Y axis</UI.Text>
          </div>
          <div className='ControlsSidebar__menu__list__items'>
            <div
              className='ControlsSidebar__menu__item'
              onClick={() => handleYScaleChange(0)}
            >
              Linear
            </div>
            <div
              className='ControlsSidebar__menu__item'
              onClick={() => handleYScaleChange(1)}
            >
              Log
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

ControlsSidebar.propTypes = {
  setChartSettingsState: PropTypes.func
};

export default ControlsSidebarYScale;