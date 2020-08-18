import './ControlsSidebar.less';

import React, { useContext } from 'react';
import HubMainScreenContext from '../../HubMainScreenContext/HubMainScreenContext';
import ControlsSidebarExport from './components/ControlsSidebarExport/ControlsSidebarExport';
import ControlsSiderbarToggleOutliers from './components/ControlsSidebarToggleOutliers/ControlsSidebarToggleOutliers';

function ControlsSidebar() {
  let hubMainScreenContext = useContext(HubMainScreenContext);

  return (
    <div className='ControlsSidebar'>
      <div className='ControlsSidebar__items'>
        <ControlsSiderbarToggleOutliers 
          disabled={hubMainScreenContext.runs.isLoading || hubMainScreenContext.runs.isEmpty}
          displayOutliers={hubMainScreenContext.chart.settings.displayOutliers}
          toggleOutliers={hubMainScreenContext.toggleOutliers}
        />
        <ControlsSidebarExport 
          disabled={hubMainScreenContext.runs.isLoading || hubMainScreenContext.runs.isEmpty} 
        />
      </div>
    </div>
  );
}

ControlsSidebar.propTypes = {};

export default ControlsSidebar;