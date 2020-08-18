import React from 'react';

import PropTypes from 'prop-types';
import UI from '../../../../../../../ui';
import { classNames } from '../../../../../../../utils';

function ControlsSiderbarToggleOutliers(props) {
  return (
    <div
      className={classNames({
        ControlsSidebar__item: true,
        disabled: props.disabled,
        active: !props.displayOutliers
      })}
      onClick={props.toggleOutliers}
      title={props.disabled ? 'Outlier toggler is disabled' : props.displayOutliers ? 'Ignore outliers' : 'Display outliers'}
    >
      <UI.Icon i='nc-vector' scale={1.4} />
    </div>
  );
}

ControlsSiderbarToggleOutliers.propTypes = {
  displayOutliers: PropTypes.bool,
  disabled: PropTypes.bool,
  toggleOutliers: PropTypes.func
};

export default ControlsSiderbarToggleOutliers;