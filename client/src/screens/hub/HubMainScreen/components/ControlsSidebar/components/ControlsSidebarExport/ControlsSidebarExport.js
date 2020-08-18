import React from 'react';
import UI from '../../../../../../../ui';
import { classNames } from '../../../../../../../utils';

import PropTypes from 'prop-types';

function ControlsSidebarExport(props) {
  function exportPanel() {
    // FIXME: Need to implement more declarative approach for getting svg element (#64)
    let svgElement = document.querySelector('#panel_svg');
    if (svgElement) {
      let { width, height } = svgElement.getBBox();
      let clonedSvgElement = svgElement.cloneNode(true);
      clonedSvgElement.style.background = '#ffffff';
      let hoverLine = clonedSvgElement.querySelector('.HoverLine');
      let hoverCircles = clonedSvgElement.querySelectorAll('.HoverCircle');
      if (hoverLine) {
        hoverLine.remove();
      }
      if (hoverCircles.length > 0) {
        hoverCircles.forEach(hoverCircle => {
          hoverCircle.remove();
        });
      }
      let outerHTML = clonedSvgElement.outerHTML;
      let blob = new Blob([outerHTML], { type: 'image/svg+xml;charset=utf-8' });
      let URL = window.URL || window.webkitURL || window;
      let blobURL = URL.createObjectURL(blob);

      let image = new Image();
      image.onload = () => {
        let canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        let context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, width, height);

        let href = canvas.toDataURL('image/jpg');
        let name = `panel-${new Date().toISOString()}.jpg`;

        downloadImage(href, name);
      };
      image.src = blobURL;
    }
  }

  function downloadImage(href, name) {
    let link = document.createElement('a');
    link.download = name;
    link.style.opacity = '0';
    document.body.append(link);
    link.href = href;
    link.click();
    link.remove();
  }

  return (
    <div
      className={classNames({
        ControlsSidebar__item: true,
        disabled: props.disabled
      })}
      onClick={exportPanel}
      title={props.disabled ? 'Export is disabled' : 'Export panel as JPEG'}
    >
      <UI.Icon i='nc-square-download' scale={1.4} />
    </div>
  );
}

ControlsSidebarExport.propTypes = {
  disabled: PropTypes.bool
};

export default ControlsSidebarExport;