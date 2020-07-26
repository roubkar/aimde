import './Panel.less';

import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import moment from 'moment';

import * as classes from '../../../../../constants/classes';
import * as storeUtils from '../../../../../storeUtils';
import { classNames, buildUrl } from '../../../../../utils';
import {
  HUB_PROJECT_EXPERIMENT,
  HUB_PROJECT_EXECUTABLE_PROCESS_DETAIL,
  HUB_PROJECT_CREATE_TAG,
} from '../../../../../constants/screens';
import UI from '../../../../../ui';
import PopUp from '../PopUp/PopUp';
import HubMainScreenContext from '../../HubMainScreenContext/HubMainScreenContext';

const d3 = require('d3');

const popUpDefaultWidth = 250;
const popUpDefaultHeight = 200;
const circleRadius = 4;
const circleActiveRadius = 7;


class Panel extends Component {
  constructor(props) {
    super(props);

    this.state = {
      // Chart
      visBox: {
        margin: {
          top: 20, right: 20, bottom: 30, left: 60,
        },
        height: null,
        width: null,
      },
      plotBox: {
        height: null,
        width: null,
      },
      chart: {
        xNum: 0,
        xMax: 0,
        xSteps: [],
        xScale: null,
        yScale: null,
      },
      key: null,

      // PopUps
      chartPopUp: {
        display: false,
        left: 0,
        top: 0,
        selectedTags: [],
        selectedTagsLoading: false,
        lineData: {},
        lineIndex: null,
        pointData: {},
      },
      tagPopUp: {
        display: false,
        isLoading: false,
        left: 0,
        top: 0,
        tags: [],
      },
      commitPopUp: {
        display: false,
        isLoading: false,
        left: 0,
        top: 0,
        data: null,
        processKillBtn: {
          loading: false,
          disabled: false,
        },
      },
    };

    this.parentRef = React.createRef();
    this.visRef = React.createRef();
    this.svg = null;
    this.plot = null;
    this.bgRect = null;
    this.hoverLine = null;
    this.circles = null;

    this.curves =  [
      'curveLinear',
      'curveBasis',
      'curveBundle',
      'curveCardinal',
      'curveCatmullRom',
      'curveMonotoneX',
      'curveMonotoneY',
      'curveNatural',
      'curveStep',
      'curveStepAfter',
      'curveStepBefore',
      'curveBasisClosed',
    ];

    this.scale = [
      'scaleLinear',
      'scaleLog',
    ];

    this.key = null;
  }

  componentDidMount() {
    this.initD3();
    this.renderChart();
    window.addEventListener('resize', () => this.resize());
  }

  componentWillUnmount() {
    window.removeEventListener('resize', () => this.resize());
  }

  resize = () => {
    this.renderChart();
  };

  initD3 = () => {
    d3.selection.prototype.moveToFront = function() {
      return this.each(function() {
        this.parentNode.appendChild(this);
      });
    };
  };

  renderChart = () => {
    console.log(`Render: Chart(${this.context.key})`);

    this.key = this.context.key;

    this.clear();

    if (this.context.metrics.isLoading || this.context.metrics.isEmpty) {
      return;
    }

    this.draw();
  };

  clear = () => {
    if (!this.visRef.current) {
      return;
    }

    const visArea = d3.select(this.visRef.current);
    visArea.selectAll('*').remove();
    visArea.attr('style', null);
  };

  draw = () => {
    if (!this.visRef.current) {
      return;
    }

    this.drawArea().then(() => this.drawAxes()).then(() => {
      window.requestAnimationFrame(() => {
        this.drawLines();
        this.drawHoverAttributes();
        this.bindInteractions();
      });
    });
  };

  drawArea = () => {
    return new Promise(resolve => {
      const parent = d3.select(this.parentRef.current);
      const visArea = d3.select(this.visRef.current);
      const parentRect = parent.node().getBoundingClientRect();
      const parentWidth = parentRect.width;
      const parentHeight = parentRect.height;

      const { margin } = this.state.visBox;
      const width = this.props.width ? this.props.width : parentWidth;
      const height = this.props.height ? this.props.height : parentHeight;

      this.setState({
        ...this.state,
        visBox: {
          ...this.state.visBox,
          width,
          height,
        },
        plotBox: {
          ...this.state.plotBox,
          width: width - margin.left - margin.right,
          height: height - margin.top - margin.bottom,
        },
      }, () => {
        visArea.style('width', `${this.state.visBox.width}px`)
          .style('height', `${this.state.visBox.height}px`);

        this.svg = visArea.append('svg')
          .attr('width', width)
          .attr('height', height);

        this.bgRect = this.svg.append('rect')
          .attr('x', margin.left)
          .attr('y', margin.top)
          .attr('width', width - margin.left - margin.right)
          .attr('height', height - margin.top - margin.bottom)
          .style('fill', 'transparent');

        this.plot = this.svg.append('g')
          .attr('transform', `translate(${margin.left}, ${margin.top})`);

        resolve();
      });
    });
  };

  drawAxes = () => {
    return new Promise(resolve => {
      const data = this.context.metrics.data;
      const { width, height, margin } = this.state.visBox;

      let xNum = 0, xMax = 0, xSteps = [];
      data.forEach(i => {
        if (i.num_steps > xMax) {
          xMax = i.num_steps;
        }
        if (i.data.length > xNum) {
          xNum = i.data.length;
          xSteps = i.data.map(s => s.step);
        }
      });

      const xScale = d3.scaleLinear()
        .domain([0, xMax])
        .range([0, width - margin.left - margin.right]);

      let yMax = d3.max(data.map((i) => Math.max(...i.data.map(i => i.value))));
      let yMin = d3.min(data.map((i) => Math.min(...i.data.map(i => i.value))));

      let yScaleBase;
      if (this.scale[this.context.chart.settings.yScale] === 'scaleLinear') {
        const diff = yMax - yMin;
        yMax += diff * 0.1;
        yMin -= diff * 0.05;
        yScaleBase = d3.scaleLinear();
      } else if (this.scale[this.context.chart.settings.yScale] === 'scaleLog') {
        yScaleBase = d3.scaleLog();
      }

      const yScale = yScaleBase
        .domain([yMin, yMax])
        .range([height - margin.top - margin.bottom, 0]);

      this.plot.append('g')
        .attr('class', 'x axis')
        .attr('transform', `translate(0, ${this.state.plotBox.height})`)
        .call(d3.axisBottom(xScale));

      this.plot.append('g')
        .attr('class', 'y axis')
        .call(d3.axisLeft(yScale));

      this.setState({
        ...this.state,
        chart: {
          ...this.state.chart,
          xNum,
          xMax,
          xSteps,
          xScale,
          yScale,
        },
      }, () => resolve());
    });
  };

  drawLines = () => {
    const metrics = this.context.metrics.data;
    const handleLineClick = this.handleLineClick;

    metrics.forEach((metric, i) => {
      const line = d3.line()
        .x(d => this.state.chart.xScale(d.step))
        .y(d => this.state.chart.yScale(d.value))
        .curve(d3[this.curves[5]]);

      this.plot.append('path')
        .datum(metric.data)
        .attr('data-hash', metric.hash)
        .style('stroke', this.context.getMetricColor(metric))
        .style('fill', 'none')
        .attr('class', `PlotLine PlotLine-${i}`)
        .attr('d', line)
        .on('click', function () {
          handleLineClick(d3.mouse(this));
        });
    });
  };

  drawHoverAttributes = () => {
    const focused = this.context.chart.focused;
    if (focused.index === null || focused.circle.active === false) {
      this.hideActionPopUps(false);
    }
    const index = focused.circle.active ? focused.circle.stepIndex : focused.index;
    if (index === null) {
      return;
    }

    const x = this.state.chart.xScale(index);
    const { height } = this.state.plotBox;

    // Draw hover line
    this.hoverLine = this.plot.append('line')
      .attr('x1', x)
      .attr('y1', 0)
      .attr('x2', x)
      .attr('y2', height)
      .attr('class', 'HoverLine')
      .style('stroke-width', 1)
      .style('stroke-dasharray', '4 2')
      .style('fill', 'none');

    // Draw circles
    const metrics = this.context.metrics.data;
    const focusedMetric = focused.metric;
    const focusedCircle = focused.circle;
    const handlePointClick = this.handlePointClick;
    let focusedCircleElem = null;

    this.circles = this.plot.append('g');
    for (let metricIndex in metrics) {
      const metric = metrics[metricIndex];
      const val = this.context.getMetricStepValueByStepIdx(metric.data, index);
      if (val) {
        const y = this.state.chart.yScale(val);
        const circle = this.circles.append('circle')
          .attr('class', `HoverCircle HoverCircle-${metricIndex}`)
          .attr('cx', x)
          .attr('cy', y)
          .attr('r', circleRadius)
          .attr('data-x', x)
          .attr('data-y', y)
          .attr('data-index', index)
          .attr('data-line-index', metricIndex)
          .attr('data-line-hash', metric.hash)
          .style('fill', this.context.getMetricColor(metric))
          .on('click', function () {
            handlePointClick(index, parseInt(metricIndex));
          });

        if (focusedCircle.active === true
          && focusedCircle.metricIndex === metricIndex
          && focusedCircle.stepIndex === index) {
          focusedCircleElem = circle;
        }
      }
    }

    // Apply focused state to line and circle
    if (focusedCircle.metricIndex !== null || focusedMetric.index !== null) {
      this.plot
        .selectAll(`.PlotLine-${(focusedCircle.metricIndex !== null ? focusedCircle.metricIndex : focusedMetric.index)}`)
        .classed('active', true);
    }
    if (focusedMetric.index !== null) {
      this.circles.selectAll('*.focus').moveToFront();

      this.circles.selectAll(`.HoverCircle-${focusedMetric.index}`)
        .classed('active', true)
        .attr('r', circleActiveRadius)
        .moveToFront();
    }

    // Add focused circle and/or apply focused state
    if (focusedCircle.active === true) {
      if (focusedCircleElem !== null) {
        focusedCircleElem
          .classed('focus', true)
          .classed('active', false)
          .attr('r', circleActiveRadius)
          .moveToFront();
      } else {
        const focusedCircleX = this.state.chart.xScale(focusedCircle.stepIndex);
        const focusedCircleVal = this.context.getMetricStepValueByStepIdx(
          metrics[focusedCircle.metricIndex].data,
          focusedCircle.stepIndex);
        const focusedCircleY = this.state.chart.yScale(focusedCircleVal);

        this.circles.append('circle')
          .attr('class', `HoverCircle HoverCircle-${focusedCircle.metricIndex} focus`)
          .attr('cx', focusedCircleX)
          .attr('cy', focusedCircleY)
          .attr('r', circleActiveRadius)
          .attr('data-x', focusedCircleX)
          .attr('data-y', focusedCircleY)
          .attr('data-index', focusedCircle.stepIndex)
          .attr('data-line-index', focusedCircle.metricIndex)
          .attr('data-line-hash', metrics[focusedCircle.metricIndex].hash)
          .style('fill', this.context.getMetricColor(metrics[focusedCircle.metricIndex]))
          .on('click', function () {
            handlePointClick(focusedCircle.stepIndex, focusedCircle.metricIndex);
          })
          .moveToFront();
      }

      // Open chart pop up
      const lineData = this.context.metrics.data[focusedCircle.metricIndex];
      const pointData = this.context.getMetricStepDataByStepIdx(lineData.data, focusedCircle.stepIndex);
      const pos = this.positionPopUp(this.state.chart.xScale(focusedCircle.stepIndex),
        this.state.chart.yScale(pointData.value));
      this.hideActionPopUps(false, () => {
        this.setState((prevState) => {
          return {
            ...prevState,
            chartPopUp: {
              left: pos.left,
              top: pos.top,
              display: true,
              selectedTags: [],
              selectedTagsLoading: true,
              lineIndex: focusedCircle.metricIndex,
              lineData,
              pointData,
            },
          };
        });

        if (this.context.isAimRun(lineData)) {
          this.getCommitTags(lineData);
        }
      });
    } else {
      this.hideActionPopUps(false);
    }
  };

  bindInteractions = () => {
    const handleAreaMouseMove = this.handleAreaMouseMove;
    const handleBgRectClick = this.handleBgRectClick;

    this.svg
      .on('mousemove', function () {
        handleAreaMouseMove(d3.mouse(this));
      });

    this.bgRect
      .on('click', function () {
        handleBgRectClick(d3.mouse(this));
      });
  };

  handleAreaMouseMove = (mouse) => {
    // Disable hover effects if circle is focused
    if (this.context.chart.focused.circle.active) {
      return false;
    }

    // Update active state
    this.setActiveLineAndCircle(mouse);

    // Remove hovered line state
    this.unsetHoveredLine(mouse);
  };

  handleVisAreaMouseOut = () => {
    this.unsetHoveredLine();
  };

  handleBgRectClick = (mouse) => {
    if (!this.context.chart.focused.circle.active) {
      return;
    }

    this.context.setChartFocusedState({
      circle: {
        active: false,
        metricIndex: null,
        stepIndex: null,
      },
      index: null,
    });

    // Update active state
    this.setActiveLineAndCircle(mouse);
  };

  handleLineClick = (mouse) => {
    if (!this.context.chart.focused.circle.active) {
      return;
    }

    this.context.setChartFocusedState({
      circle: {
        active: false,
        metricIndex: null,
        stepIndex: null,
      },
      index: null,
    });

    // Update active state
    this.setActiveLineAndCircle(mouse, false);
  };

  handlePointClick = (stepIndex, metricIndex) => {
    this.context.setChartFocusedState({
      circle: {
        active: true,
        stepIndex,
        metricIndex,
      },
      metric: {
        hash: null,
        index: null,
      },
    });
  };

  setActiveLineAndCircle = (mouse, marginInc=true) => {
    const { margin } = this.state.visBox;

    if (this.isMouseInVisArea(mouse)) {
      const data = this.state.chart.xSteps;
      const x = marginInc ? mouse[0] - margin.left : mouse[0];
      const y = marginInc ? mouse[1] - margin.top : mouse[1];
      let index = 0;

      if (x >= 0) {
        // Line
        const xPoint = this.state.chart.xScale.invert(x);
        const relIndex = d3.bisect(data, xPoint, 1);
        const a = data[relIndex - 1];
        const b = data[relIndex];

        index = xPoint - a > b - xPoint ? b : a;

        if (index !== this.context.chart.focused.index) {
          this.context.setChartFocusedState({
            index,
          });
        }

        // Circles
        let nearestCircleY = null, nearestCircleRunIndex = null, nearestCircleRunHash = null;

        // Find the nearest circle
        if (this.circles) {
          this.circles.selectAll('.HoverCircle').each(function () {
            const elem = d3.select(this);
            const elemY = parseFloat(elem.attr('data-y'));
            const r = Math.abs(elemY - y);

            if (nearestCircleY === null || r < nearestCircleY) {
              nearestCircleY = r;
              nearestCircleRunIndex = parseInt(elem.attr('data-line-index'));
              nearestCircleRunHash = elem.attr('data-line-hash');
            }
          });

          if (nearestCircleRunIndex !== null
            && nearestCircleRunIndex !== this.context.chart.focused.metric.index) {
            this.context.setChartFocusedState({
              metric: {
                index: nearestCircleRunIndex,
                hash: nearestCircleRunHash,
              },
            });
          }
        }
      }
    }
  };

  unsetHoveredLine = (mouse=false) => {
    if (mouse === false || !this.isMouseInVisArea(mouse)) {
      this.context.setChartFocusedState({
        metric: {
          index: null,
          hash: null,
        },
      });
    }
  };

  isMouseInVisArea = (mouse) => {
    const { width, height, margin } = this.state.visBox;
    const padding = 5;

    return (mouse[0] > margin.left - padding && mouse[0] < width - margin.right + padding &&
      mouse[1] > margin.top - padding && mouse[1] < height - margin.bottom + padding)
  };

  /* PopUp Actions */
  positionPopUp = (x, y, chained=null, popUpWidth=popUpDefaultWidth, popUpHeight=popUpDefaultHeight) => {
    const { margin } = this.state.visBox;
    const { width, height } = this.state.plotBox;

    const leftOverflow = x => popUpWidth + x > width;
    const topOverflow = y => popUpHeight + y > height;

    let left = 0, top = 0, chainArrow = null;

    if (chained !== null) {
      if (chained.left + 2 * popUpWidth > width) {
        left = chained.left - popUpWidth;
        chainArrow = 'right';
      } else {
        left = x;
        chainArrow = 'left';
      }
      top = chained.top;
    } else {
      if (leftOverflow(x)) {
        left = x - popUpWidth + margin.left;
      } else {
        left = x + margin.left;
      }

      if (topOverflow(y)) {
        top = y - popUpHeight + margin.top;
      } else {
        top = y + margin.top;
      }
    }

    return {
      left,
      top,
      chainArrow,
    };
  };

  hideActionPopUps = (onlySecondary=false, callback=null) => {
    this.setState(prevState => {
      const state = {
        ...prevState,
        tagPopUp: {
          ...prevState.tagPopUp,
          display: false,
        },
        commitPopUp: {
          ...prevState.tagPopUp,
          display: false,
        }
      };

      if (!onlySecondary) {
        Object.assign(state, {
          chartPopUp: {
            ...prevState.chartPopUp,
            display: false,
          },
        });
      }

      return state;
    }, () => {
      if (callback) {
        callback();
      }
    });
  };

  getCommitTags = (lineData) => {
    this.props.getCommitTags(lineData.hash)
      .then((data) => {
        this.setState((prevState) => ({
          ...prevState,
          chartPopUp: {
            ...prevState.chartPopUp,
            selectedTags: data,
          },
        }));
      })
      .catch(() => {
        this.setState((prevState) => ({
          ...prevState,
          chartPopUp: {
            ...prevState.chartPopUp,
            selectedTags: [],
          },
        }));
      })
      .finally(() => {
        this.setState((prevState) => ({
          ...prevState,
          chartPopUp: {
            ...prevState.chartPopUp,
            selectedTagsLoading: false,
          },
        }));
      });
  };

  handleTagItemClick = (lineData, tag) => {
    this.setState((prevState) => ({
      ...prevState,
      chartPopUp: {
        ...prevState.chartPopUp,
        selectedTagsLoading: true,
      },
    }));

    this.props.updateCommitTag({
      commit_hash: lineData.hash,
      tag_id: tag.id,
      experiment_name: lineData.branch,
    }).then(tagsIds => {
      this.getCommitTags(lineData);

      // Update metrics
      const data = [...this.context.metrics.data];
      data.forEach((i) => {
        if (i.hash === lineData.hash) {
          i.tag = tag;
        }
      });
      this.context.setMetricsState({
        ...this.context.metrics,
        data: data,
      });
    });
  };

  handleAttachTagClick = (lineData) => {
    const pos = this.positionPopUp(
      this.state.chartPopUp.left + popUpDefaultWidth,
      this.state.chartPopUp.top,
      this.state.chartPopUp);

    this.setState(prevState => ({
      ...prevState,
      tagPopUp: {
        ...prevState.tagPopUp,
        ...pos,
        display: true,
        isLoading: true,
      },
    }));

    this.hideActionPopUps(true, () => {
      this.props.getTags().then(data => {
        this.setState(prevState => ({
          ...prevState,
          tagPopUp: {
            ...prevState.tagPopUp,
            display: true,
            tags: data,
            isLoading: false,
          },
        }));
      });
    });
  };

  handleProcessKill = (pid, idx) => {
    this.setState(prevState => ({
      ...prevState,
      commitPopUp: {
        ...prevState.commitPopUp,
        processKillBtn: {
          loading: true,
          disabled: true,
        },
      },
    }));

    this.props.killRunningExecutable(pid).then((data) => {
      // this.getProcesses();
      this.handleCommitInfoClick(idx);
    });
  };

  handleCommitInfoClick = (lineIndex) => {
    const data = this.context.metrics.data;
    const lineData = data[lineIndex];

    const pos = this.positionPopUp(
      this.state.chartPopUp.left + popUpDefaultWidth,
      this.state.chartPopUp.top,
      this.state.chartPopUp);

    this.hideActionPopUps(true, () => {
      this.setState(prevState => ({
        ...prevState,
        commitPopUp: {
          ...prevState.commitPopUp,
          display: true,
          left: pos.left,
          top: pos.top,
          chainArrow: pos.chainArrow,
          processKillBtn: {
            loading: false,
            disabled: false,
          },
          isLoading: true,
        },
      }));

      this.props.getCommitInfo(lineData.branch, lineData.hash).then((data) => {
        this.setState(prevState => ({
          ...prevState,
          commitPopUp: {
            ...prevState.commitPopUp,
            isLoading: false,
            data,
          },
        }));
      });
    });
  };

  _renderPopUpContent = () => {
    const lineData = this.state.chartPopUp.lineData;
    const commitPopUpData = this.state.commitPopUp.data;

    return (
      <>
        <div className='ControlPanel__body'>
          {this.state.chartPopUp.display &&
          <PopUp
            className='ChartPopUp'
            left={this.state.chartPopUp.left}
            top={this.state.chartPopUp.top}
            xGap={true}
          >
            <div>
              {this.context.isAimRun(lineData) &&
              <div>
                {!this.state.chartPopUp.selectedTagsLoading
                  ? (
                    <div className='ControlPanel__popup__tags__wrapper'>
                      <UI.Text overline type='grey-darker'>tag</UI.Text>
                      <div className='ControlPanel__popup__tags'>
                        {this.state.chartPopUp.selectedTags.length
                          ? (
                            <>
                              {this.state.chartPopUp.selectedTags.map((tagItem, i) =>
                                <UI.Label key={i} color={tagItem.color}>
                                  {tagItem.name}
                                </UI.Label>
                              )}
                            </>
                          )
                          : <UI.Label>No attached tag</UI.Label>
                        }
                        <div
                          className='ControlPanel__popup__tags__update'
                          onClick={() => this.handleAttachTagClick(lineData)}
                        >
                          <UI.Icon i='nc-pencil'/>
                        </div>
                      </div>
                    </div>
                  )
                  : (
                    <UI.Text type='grey' center spacingTop spacing>Loading..</UI.Text>
                  )
                }
                <UI.Line/>
              </div>
              }
              {this.context.isAimRun(lineData) &&
              <>
                <UI.Text
                  className='link'
                  type='primary'
                  onClick={() => this.handleCommitInfoClick(this.state.chartPopUp.lineIndex)}
                >
                  Run details
                </UI.Text>
                <UI.Line />
              </>
              }
              {this.context.isTFSummaryScalar(lineData) &&
              <>
                <div className='ControlPanel__popup__tags__wrapper'>
                  <UI.Text overline type='grey-darker'>tag</UI.Text>
                  <div className='ControlPanel__popup__tags'>
                    <UI.Label>
                      {lineData.tag.name}
                    </UI.Label>
                  </div>
                </div>
                <UI.Line />
                <UI.Text overline type='grey-darker'>tf.summary scalar</UI.Text>
                <UI.Text type='grey-dark'>{lineData.name}</UI.Text>
                <UI.Text type='grey' small>{moment.unix(lineData.date).format('HH:mm · D MMM, YY')}</UI.Text>
                <UI.Line />
              </>
              }
              <UI.Text color={this.context.getMetricColor(lineData)}>
                Value: {Math.round(this.state.chartPopUp.pointData.value*10e9)/10e9}
              </UI.Text>
              {this.state.chartPopUp.pointData.epoch !== null &&
              <UI.Text type='grey' small>Epoch: {this.state.chartPopUp.pointData.epoch}</UI.Text>
              }
              <UI.Text type='grey' small>
                Step: {this.state.chartPopUp.pointData.step}
                {this.context.isTFSummaryScalar(lineData) &&
                  <> (local step: {this.state.chartPopUp.pointData.local_step}) </>
                }
              </UI.Text>
            </div>
          </PopUp>
          }
          {this.state.tagPopUp.display &&
          <PopUp
            className='TagPopUp'
            left={this.state.tagPopUp.left}
            top={this.state.tagPopUp.top}
            chainArrow={this.state.tagPopUp.chainArrow}
            xGap={true}
          >
            {this.state.tagPopUp.isLoading
              ? (
                <UI.Text type='grey' center>Loading..</UI.Text>
              )
              : (
                <div className='TagPopUp__tags'>
                  <div className='TagPopUp__tags__title'>
                    <UI.Text type='grey' inline>
                      Select a tag
                    </UI.Text>
                    <Link to={HUB_PROJECT_CREATE_TAG}>
                      <UI.Button type='positive' size='tiny'>Create</UI.Button>
                    </Link>
                  </div>
                  <UI.Line spacing={false} />
                  <div className='TagPopUp__tags__box'>
                    {!this.state.tagPopUp.tags.length &&
                    <UI.Text type='grey' center spacingTop spacing>
                      Empty
                    </UI.Text>
                    }
                    {this.state.tagPopUp.tags.map((tag, tagKey) =>
                      <UI.Label
                        className={classNames({
                          TagPopUp__tags__item: true,
                          active: this.state.chartPopUp.selectedTags.map(i => i.id).includes(tag.id),
                        })}
                        key={tagKey}
                        color={tag.color}
                        onClick={() => this.handleTagItemClick(lineData, tag)}
                      >
                        {tag.name}
                      </UI.Label>
                    )}
                  </div>
                </div>
              )
            }
          </PopUp>
          }
          {this.state.commitPopUp.display &&
            <PopUp
              className='CommitPopUp'
              left={this.state.commitPopUp.left}
              top={this.state.commitPopUp.top}
              chainArrow={this.state.commitPopUp.chainArrow}
              xGap={true}
            >
              {this.state.commitPopUp.isLoading
                ? (
                  <UI.Text type='grey' center spacingTop>Loading..</UI.Text>
                ) : (
                  <>
                    <UI.Text type='grey' small>
                      {moment.unix(lineData.date).format('HH:mm · D MMM, YY')}
                    </UI.Text>
                    <Link
                      to={buildUrl(HUB_PROJECT_EXPERIMENT, {
                        experiment_name: lineData.branch,
                        commit_id: lineData.hash,
                      })}
                    >
                      <UI.Text type='primary'>Detailed View</UI.Text>
                    </Link>
                    <UI.Line />
                    {(!Number.isInteger(lineData.msg) || `${lineData.msg}`.length !== 10) &&
                    <>
                      <UI.Text type='grey-darker' small spacing>{lineData.msg}</UI.Text>
                      <UI.Line />
                    </>
                    }
                    <UI.Text type='grey' small>Experiment: {lineData.branch}</UI.Text>
                    <UI.Text type='grey' small>Hash: {lineData.hash}</UI.Text>
                    {!!commitPopUpData.process &&
                    <>
                      <UI.Line />
                      {!!commitPopUpData.process.uuid &&
                      <Link to={buildUrl(HUB_PROJECT_EXECUTABLE_PROCESS_DETAIL, {
                        process_id: commitPopUpData.process.uuid
                      })}>
                        <UI.Text>Process</UI.Text>
                      </Link>
                      }
                      <UI.Text type='grey' small>Process status: {commitPopUpData.process.finish ? 'finished' : 'running'}</UI.Text>
                      {!!commitPopUpData.process.start_date &&
                      <UI.Text type='grey' small>
                        Time: {Math.round((
                          commitPopUpData.process.finish
                            ? (commitPopUpData.date - commitPopUpData.process.start_date)
                            : (commitPopUpData.process.time || '-')
                        ))}
                      </UI.Text>
                      }
                      {!!commitPopUpData.process.pid &&
                      <div className='CommitPopUp__process'>
                        <UI.Text type='grey' small inline>PID: {commitPopUpData.process.pid} </UI.Text>
                        <UI.Button
                          onClick={() => this.handleProcessKill(commitPopUpData.process.pid, this.state.chartPopUp.lineIndex)}
                          type='negative'
                          size='tiny'
                          inline
                          {...this.state.commitPopUp.processKillBtn}
                        >
                          Kill
                        </UI.Button>
                      </div>
                      }
                    </>
                    }
                  </>
                )
              }
            </PopUp>
          }
        </div>
      </>
    );
  };

  _renderPanelMsg = (Elem) => {
    return (
      <div className='ControlPanel__msg__wrapper'>
        {Elem}
      </div>
    );
  };

  render() {
    return (
      <div className='ControlPanel' ref={this.parentRef}>
        <div ref={this.visRef} className='ControlPanel__svg' />
        {this.context.metrics.isLoading
          ? (
            this.context.search.query.indexOf('include:tf_logs') === -1
              ? this._renderPanelMsg(<UI.Text type='grey' center>Loading..</UI.Text>)
              : this._renderPanelMsg(<UI.Text type='grey' center>Loading tf.summary logs can take some time..</UI.Text>)
          )
          : <>
            {this.context.metrics.isEmpty
              ? this._renderPanelMsg(
                <>
                  {!!this.context.search.query
                    ? <UI.Text type='grey' center>You haven't recorded experiments matching this query.</UI.Text>
                    : <UI.Text type='grey' center>It's super easy to search Aim experiments.</UI.Text>
                  }
                  <UI.Text type='grey' center>
                    Lookup
                    {' '}
                    <a
                      className='link'
                      href='https://github.com/aimhubio/aim#searching-experiments'
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      search docs
                    </a>
                    {' '}
                    to learn more.
                  </UI.Text>
                </>
              )
              : this._renderPopUpContent()
            }
          </>
        }
      </div>
    );
  }
}

Panel.defaultProps = {
  width: null,
  height: null,
  ratio: null,
};

Panel.propTypes = {
  width: PropTypes.number,
  height: PropTypes.number,
  ratio: PropTypes.number,
};

Panel.contextType = HubMainScreenContext;

export default storeUtils.getWithState(
  classes.CONTROL_PANEL,
  Panel
);