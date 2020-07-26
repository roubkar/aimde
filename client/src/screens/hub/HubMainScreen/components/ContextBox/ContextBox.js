import './ContextBox.less';

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Color from 'color';
import moment from 'moment';

import HubMainScreenContext from '../../HubMainScreenContext/HubMainScreenContext';
import { classNames } from '../../../../../utils';
import UI from '../../../../../ui';


class ContextBox extends Component {
  aimMetricExists = () => {
    for (let m in this.context.metrics.data) {
      if (this.context.isAimRun(this.context.metrics.data[m])) {
        return true;
      }
    }
  };

  formatValue = (v) => {
    return v ? Math.round(v * 10e6) / 10e6 : 0;
  };

  _renderTableHeaderParams = (params, paramGroups=null, paramGroupsGap=null) => {
    if (!params || !params.length) {
      return null;
    }

    return (
      <>
        {!!paramGroups && !!paramGroups.length &&
          <tr className='ContextBox__table__header'>
            {!!paramGroupsGap &&
              <td colSpan={paramGroupsGap} />
            }
            {paramGroups.map((n, nKey) => (
              <td key={nKey} colSpan={this.context.params.unionFields[n].length}>
                {n}
              </td>
            ))}
          </tr>
        }
        {!!params && !!params.length &&
          <tr className='ContextBox__table__subheader'>
            {params.map((f, fKey) => (
              <td key={fKey}>
                {f}
              </td>
            ))}
          </tr>
        }
      </>
    )
  };

  _renderItem = (hash, params) => {
    const index = this.context.chart.focused.index;
    const lineData = this.context.getMetricByHash(hash);
    if (lineData === null) {
      return null;
    }

    const stepData = this.context.getMetricStepDataByStepIdx(lineData.data, index);

    const color = this.context.getMetricColor(lineData);
    const colorObj = Color(color);

    const circleMetricIndex = this.context.chart.focused.circle.metricIndex;
    let active = false;
    if (this.context.chart.focused.metric.hash === hash
      || (circleMetricIndex !== null && this.context.metrics.data[circleMetricIndex] !== null
        && this.context.metrics.data[circleMetricIndex].hash === hash)) {
      active = true;
    }

    const className = classNames({
      ContextBox__table__item: true,
      active: active,
    });

    let style = {};
    if (active) {
      style = {
        borderLeftColor: color,
        backgroundColor: colorObj.alpha(0.15).hsl().string(),
      };
    }

    const isAimRun = this.context.isAimRun(lineData);

    return (
      <tr className={className} style={style} key={hash}>
        <td>
          <div
            className='ContextBox__table__item__run'
            style={{
              color: color,
            }}
          >
            <div className='ContextBox__table__item__tag__dot' style={{ backgroundColor: color }} />
            {isAimRun && !!lineData.tag &&
            `${lineData.tag.name}: `
            }
            {!!lineData.date &&
            moment.unix(lineData.date).format('HH:mm · D MMM, YY')
            }
          </div>
        </td>
        <td>
          {stepData !== null ? this.formatValue(stepData.value) : '-'}
        </td>
        <td>
          {stepData !== null ? stepData.step : '-'}
        </td>
        <td>
          {stepData !== null && stepData.epoch !== null ? stepData.epoch : '-'}
        </td>
        {isAimRun
          ? this._renderAimRunContextItem(lineData, params)
          : this._renderTFLogContextItem(lineData, params)
        }
      </tr>
    );
  };

  _renderAimRunContextItem = (lineData, params) => {
    if (!this.context.isAimRun(lineData)) {
      return null;
    }

    return (
      <td>
        {(!!params && !!params.data && !!Object.keys(params.data).length)
          ? Object.keys(this.context.params.unionFields).map((n, nKey) => (
            this.context.params.unionFields[n].map((f, fKey) => (
              params.data.hasOwnProperty(n) && params.data[n].hasOwnProperty(f) &&
                <span
                  className='ContextBox__param__item'
                  key={nKey * this.context.params.unionFields[n].length + fKey}
                >
                  {f}={params.data[n][f]}
                </span>
            ))
          ))
          : '-'
        }
      </td>
    )
  };

  _renderTFLogContextItem = (lineData, params) => {
    if (!this.context.isTFSummaryScalar(lineData)) {
      return null;
    }

    return (
      <td>
        {(!!params && !!params.data && !!Object.keys(params.data).length)
          ? (
            <>
              {Object.keys(params.data).map((n, nKey) => (
                <span className='ContextBox__param__item' key={nKey}>
                  {n}={params.data[n]}
                </span>
              ))}
              <span className='ContextBox__param__item' key={-1}>
                ({lineData.name})
              </span>
            </>
          )
          : lineData.name
        }
      </td>
    )
  };

  _renderContent = () => {
    if (this.context.metrics.isLoading || (this.context.metrics.data.length && this.context.params.isLoading)) {
      return <UI.Text type='grey' center spacingTop>Loading..</UI.Text>
    }

    if (!this.context.metrics.data.length
      || !this.context.params.unionFields
      || !this.context.params.unionNamespaces) {
      return null;
    }

    /*
    {this._renderTableHeaderParams(
      ['Run', 'Value', 'Step', 'Epoch', ...Object.values(this.context.params.unionFields).flat()],
      Object.keys(this.context.params.unionFields), 4
    )}
     */

    return (
      <div className='ContextBox__content'>
        <div className='ContextBox__table__wrapper'>
          <table className='ContextBox__table' cellSpacing={0} cellPadding={0}>
            <tbody>
              <tr className='ContextBox__table__topheader'>
                <td>
                  <UI.Text overline bold>Run</UI.Text>
                </td>
                <td>
                  <UI.Text overline bold>Value</UI.Text>
                </td>
                <td>
                  <UI.Text overline bold>Step</UI.Text>
                </td>
                <td>
                  <UI.Text overline bold>Epoch</UI.Text>
                </td>
                <td>
                  <UI.Text overline bold>Params</UI.Text>
                </td>
              </tr>
              {Object.keys(this.context.params.data).map((runHash) => (
                this._renderItem(runHash, this.context.params.data[runHash])
              ))}
              {this.context.getTFSummaryScalars().map((s) =>
                this._renderItem(s.hash, this.context.params.data[s.path])
              )}
            </tbody>
          </table>
        </div>
      </div>
    );

  };

  render() {
    return (
      <div className='ContextBox' style={{
        width: `${this.props.width}px`,
      }}>
        {this._renderContent()}
      </div>
    );
  }
}

ContextBox.propTypes = {};

ContextBox.contextType = HubMainScreenContext;

export default ContextBox;