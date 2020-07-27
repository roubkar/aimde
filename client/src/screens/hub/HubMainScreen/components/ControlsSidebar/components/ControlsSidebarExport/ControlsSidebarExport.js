import React from 'react';
import UI from '../../../../../../../ui';

function ControlsSidebarExport() {
  // Need to add logic for handling disabled state
  let disabled = false;

  function exportPanel() {
    // Need to implement more declarative approach for getting svg element
    let svgElement = document.querySelector('svg');
    if (svgElement) {
      let { width, height } = svgElement.getBBox();
      let clonedSvgElement = svgElement.cloneNode(true);
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
      className={`ControlsSidebar__item ${disabled ? 'ControlsSidebar__item--disabled' : ''}`.trim()}
      onClick={exportPanel}
      title={disabled ? 'Export is disabled' : 'Export panel as JPEG'}
    >
      <UI.Icon i='nc-square-download' scale={1.4} />
    </div>
  );
}

export default ControlsSidebarExport;