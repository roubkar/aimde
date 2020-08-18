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
        run: null,
        metric: null,
        trace: null,
        point: null,
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
    setTimeout(() => this.renderChart(), 1000);
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

    if (this.context.runs.isLoading || this.context.runs.isEmpty) {
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
          .attr('height', height)
          .attr('xmlns', 'http://www.w3.org/2000/svg')
          .attr('id', 'panel_svg');

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
      const runs = this.context.runs.data;

      const { width, height, margin } = this.state.visBox;

      let xNum = 0, xMax = 0, xSteps = [];
      runs.forEach((run) => {
        run.metrics.forEach((metric) => {
          metric.traces.forEach((trace) => {
            if (trace.num_steps > xMax) {
              xMax = trace.num_steps;
            }
            if (trace.data.length > xNum) {
              xNum = trace.data.length;
              xSteps = trace.data.map(s => s[1]);
            }
          });
        });
      });

      const xScale = d3.scaleLinear()
        .domain([0, xMax])
        .range([0, width - margin.left - margin.right]);

      let yMax = null, yMin = null;

      runs.forEach((run) => {
        run.metrics.forEach((metric) => {
          metric.traces.forEach((trace) => {
            let traceMax;
            if (this.context.chart.settings.displayOutliers) {
              traceMax = Math.max(...trace.data.map(elem => elem[0]));
            } else {
              let values = trace.data.map(elem => elem[0]);
              values.sort((a, b) => a - b);
              let q1 = values[Math.floor((values.length / 4))];
              let q3 = values[Math.ceil((values.length * (3 / 4)))];
              // the inter-quartile range
              let iqr = q3 - q1;
              // Find max value
              traceMax = q3 + iqr * 1.5;
            }
            const traceMin = Math.min(...trace.data.map(elem => elem[0]));
            if (yMax == null || traceMax > yMax) {
              yMax = traceMax;
            }
            if (yMin == null || traceMin < yMin) {
              yMin = traceMin;
            }
          });
        });
      });

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
    const runs = this.context.runs.data;
    const handleLineClick = this.handleLineClick;

    runs.forEach((run) => {
      run.metrics.forEach((metric) => {
        metric.traces.forEach((trace) => {
          const line = d3.line()
            .x(d => this.state.chart.xScale(d[1]))
            .y(d => this.state.chart.yScale(d[0]))
            .curve(d3[this.curves[5]]);

          this.plot.append('path')
            .attr('class', `PlotLine PlotLine-${this.context.traceToHash(run.run_hash, metric.name, trace.context)}`)
            .datum(trace.data)
            .attr('d', line)
            .style('fill', 'none')
            .style('stroke', this.context.getMetricColor(run, metric, trace))
            .attr('data-run-hash', run.run_hash)
            .attr('data-metric-name', metric.name)
            .attr('data-trace-context-hash', this.context.contextToHash(trace.context))
            .on('click', function () {
              handleLineClick(d3.mouse(this));
            });
        });
      });
    });
  };

  drawHoverAttributes = () => {
    const focused = this.context.chart.focused;
    if (focused.runHash === null || focused.circle.active === false) {
      this.hideActionPopUps(false);
    }
    const step = focused.circle.active ? focused.circle.step : focused.step;
    if (step === null || step === undefined) {
      return;
    }

    const x = this.state.chart.xScale(step);
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
    const runs = this.context.runs.data;
    const focusedMetric = focused.metric;
    const focusedCircle = focused.circle;
    const handlePointClick = this.handlePointClick;
    let focusedCircleElem = null;

    this.circles = this.plot.append('g');

    runs.forEach((run) => {
      run.metrics.forEach((metric) => {
        metric.traces.forEach((trace) => {
          const val = this.context.getMetricStepValueByStepIdx(trace.data, step);
          if (val !== null) {
            const y = this.state.chart.yScale(val);
            const traceContext = this.context.contextToHash(trace.context);
            const circle = this.circles.append('circle')
              .attr('class', `HoverCircle HoverCircle-${step} HoverCircle-${this.context.traceToHash(run.run_hash, metric.name, traceContext)}`)
              .attr('cx', x)
              .attr('cy', y)
              .attr('r', circleRadius)
              .attr('data-x', x)
              .attr('data-y', y)
              .attr('data-step', step)
              .attr('data-run-hash', run.run_hash)
              .attr('data-metric-name', metric.name)
              .attr('data-trace-context-hash', this.context.contextToHash(trace.context))
              .style('fill', this.context.getMetricColor(run, metric, trace))
              .on('click', function () {
                handlePointClick(step, run.run_hash, metric.name, traceContext);
              });

            if (focusedCircle.active === true
              && focusedCircle.runHash === run.run_hash
              && focusedCircle.metricName === metric.name
              && focusedCircle.traceContext === traceContext
              && focusedCircle.step === step) {
              focusedCircleElem = circle;
            }
          }
        });
      });
    });

    // Apply focused state to line and circle
    if (focusedCircle.runHash !== null || focusedMetric.runHash !== null) {
      const focusedLineAttr = focusedCircle.runHash !== null ? focusedCircle : focusedMetric;
      this.plot
        .selectAll(`.PlotLine-${this.context.traceToHash(focusedLineAttr.runHash, focusedLineAttr.metricName, focusedLineAttr.traceContext)}`)
        .classed('active', true);
    }
    if (focusedMetric.runHash !== null) {
      this.circles.selectAll('*.focus').moveToFront();
      this.circles.selectAll(`.HoverCircle-${this.context.traceToHash(focusedMetric.runHash, focusedMetric.metricName, focusedMetric.traceContext)}`)
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
        const focusedCircleX = this.state.chart.xScale(focusedCircle.step);
        const line = this.context.getTraceData(focusedCircle.runHash, focusedCircle.metricName, focusedCircle.traceContext);
        const focusedCircleVal = this.context.getMetricStepValueByStepIdx(line.data, focusedCircle.step);
        const focusedCircleY = this.state.chart.yScale(focusedCircleVal);

        this.circles.append('circle')
          .attr('class', `HoverCircle HoverCircle-${focusedCircle.metricIndex} focus`)
          .attr('cx', focusedCircleX)
          .attr('cy', focusedCircleY)
          .attr('r', circleActiveRadius)
          .attr('data-x', focusedCircleX)
          .attr('data-y', focusedCircleY)
          .attr('data-step', step)
          .attr('data-run-hash', focusedCircle.runHash)
          .attr('data-metric-name', focusedCircle.metricName)
          .attr('data-trace-context-hash', focusedCircle.traceContext)
          .style('fill', this.context.getMetricColor(line.run, line.metric, line.trace))
          .on('click', function() {
            handlePointClick(focusedCircle.runHash,
              focusedCircle.metricName,
              focusedCircle.traceContext);
          })
          .moveToFront();
      }

      // Open chart pop up
      const line =  this.context.getTraceData(focusedCircle.runHash, focusedCircle.metricName,
        focusedCircle.traceContext);
      const point = this.context.getMetricStepDataByStepIdx(line.data, focusedCircle.step);
      const pos = this.positionPopUp(this.state.chart.xScale(focusedCircle.step),
        this.state.chart.yScale(point[0]));
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
              run: line.run,
              metric: line.metric,
              trace: line.trace,
              point: point,
            },
          };
        });

        if (this.context.isAimRun(line.run)) {
          this.getCommitTags(line.run.run_hash);
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
        runHash: null,
        metricName: null,
        traceContext: null,
      },
      step: null,
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
        runHash: null,
        metricName: null,
        traceContext: null,
        step: null,
      },
      step: null,
    });

    // Update active state
    this.setActiveLineAndCircle(mouse, false);
  };

  handlePointClick = (step, runHash, metricName, traceContext) => {
    this.context.setChartFocusedState({
      circle: {
        active: true,
        step,
        runHash,
        metricName,
        traceContext,
      },
      metric: {
        runHash: null,
        metricName: null,
        traceContext: null,
      },
    });
  };

  setActiveLineAndCircle = (mouse, marginInc=true) => {
    const { margin } = this.state.visBox;

    if (this.isMouseInVisArea(mouse)) {
      const data = this.state.chart.xSteps;
      const x = marginInc ? mouse[0] - margin.left : mouse[0];
      const y = marginInc ? mouse[1] - margin.top : mouse[1];
      let step = 0;

      if (x >= 0) {
        // Line
        const xPoint = this.state.chart.xScale.invert(x);
        const relIndex = d3.bisect(data, xPoint, 1);
        const a = data[relIndex - 1];
        const b = data[relIndex];

        step = xPoint - a > b - xPoint ? b : a;

        if (step !== this.context.chart.focused.step) {
          this.context.setChartFocusedState({
            step,
          });
        }

        // Find the nearest circle
        if (this.circles) {
          // Circles
          let nearestCircle = [];

          this.circles.selectAll('.HoverCircle').each(function () {
            const elem = d3.select(this);
            const elemY = parseFloat(elem.attr('data-y'));
            const r = Math.abs(elemY - y);

            if (nearestCircle.length === 0 || r < nearestCircle[0].r) {
              nearestCircle = [{
                r: r,
                nearestCircleRunHash: elem.attr('data-run-hash'),
                nearestCircleMetricName: elem.attr('data-metric-name'),
                nearestCircleTraceContext: elem.attr('data-trace-context-hash'),
              }];
            } else if (nearestCircle.length && r === nearestCircle[0].r) {
              nearestCircle.push({
                r: r,
                nearestCircleRunHash: elem.attr('data-run-hash'),
                nearestCircleMetricName: elem.attr('data-metric-name'),
                nearestCircleTraceContext: elem.attr('data-trace-context-hash'),
              });
            }
          });

          nearestCircle.sort((a, b) => {
            const aHash = this.context.traceToHash(a.nearestCircleRunHash, a.nearestCircleMetricName,
              a.nearestCircleTraceContext);
            const bHash = this.context.traceToHash(b.nearestCircleRunHash, b.nearestCircleMetricName,
              b.nearestCircleTraceContext);
            return aHash > bHash ? 1 : -1;
          });

          if (nearestCircle.length) {
            const nearestCircleRunHash = nearestCircle[0].nearestCircleRunHash;
            const nearestCircleMetricName = nearestCircle[0].nearestCircleMetricName;
            const nearestCircleTraceContext = nearestCircle[0].nearestCircleTraceContext;

            if (nearestCircleRunHash !== this.context.chart.focused.metric.runHash
              || nearestCircleMetricName !== this.context.chart.focused.metric.metricName
              || nearestCircleTraceContext !== this.context.chart.focused.metric.traceContext
            ) {
              this.context.setChartFocusedState({
                metric: {
                  runHash: nearestCircleRunHash,
                  metricName: nearestCircleMetricName,
                  traceContext: nearestCircleTraceContext,
                },
              });
            }
          }
        }
      }
    }
  };

  unsetHoveredLine = (mouse=false) => {
    if (mouse === false || !this.isMouseInVisArea(mouse)) {
      this.context.setChartFocusedState({
        metric: {
          runHash: null,
          metricName: null,
          traceContext: null,
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

  getCommitTags = (runHash) => {
    this.props.getCommitTags(runHash)
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

  handleTagItemClick = (runHash, experimentName, tag) => {
    this.setState((prevState) => ({
      ...prevState,
      chartPopUp: {
        ...prevState.chartPopUp,
        selectedTagsLoading: true,
      },
    }));

    this.props.updateCommitTag({
      commit_hash: runHash,
      tag_id: tag.id,
      experiment_name: experimentName,
    }).then(tagsIds => {
      this.getCommitTags(runHash);

      // Update metrics
      // const data = [...this.context.runs.data];
      // data.forEach((i) => {
      //   if (i.hash === runHash) {
      //     i.tag = tag;
      //   }
      // });
      // this.context.setRunsState({
      //   ...this.context.runs,
      //   data: data,
      // });
    });
  };

  handleAttachTagClick = () => {
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

  handleProcessKill = (pid, runHash, experimentName) => {
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
      this.handleCommitInfoClick(runHash, experimentName);
    });
  };

  handleCommitInfoClick = (runHash, experimentName) => {
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

      this.props.getCommitInfo(experimentName, runHash).then((data) => {
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
    const { run, metric, trace, point } = this.state.chartPopUp;
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
              {this.context.isAimRun(run) &&
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
                          onClick={() => this.handleAttachTagClick()}
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
              {this.context.isAimRun(run) &&
              <>
                <UI.Text
                  className='link'
                  type='primary'
                  onClick={() => this.handleCommitInfoClick(run.run_hash, run.experiment_name)}
                >
                  Run details
                </UI.Text>
                <UI.Line />
              </>
              }
              {this.context.isTFSummaryScalar(run) &&
              <>
                <div className='ControlPanel__popup__tags__wrapper'>
                  <UI.Text overline type='grey-darker'>tag</UI.Text>
                  <div className='ControlPanel__popup__tags'>
                    <UI.Label>
                      {metric.tag.name}
                    </UI.Label>
                  </div>
                </div>
                <UI.Line />
                <UI.Text overline type='grey-darker'>tf.summary scalar</UI.Text>
                <UI.Text type='grey-dark'>{run.name}</UI.Text>
                {/*<UI.Text type='grey' small>{moment.unix(run.date).format('HH:mm · D MMM, YY')}</UI.Text>*/}
                <UI.Line />
              </>
              }
              <UI.Text type='grey-darker'>
                Value: {Math.round(point[0]*10e9)/10e9}
              </UI.Text>
              {point[2] !== null &&
              <UI.Text type='grey' small>Epoch: {point[2]}</UI.Text>
              }
              <UI.Text type='grey' small>
                Step: {point[1]}
                {this.context.isTFSummaryScalar(run) &&
                  <> (local step: {point[4]}) </>
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
                        onClick={() => this.handleTagItemClick(run.run_hash, run.experiment_name, tag)}
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
                  <UI.Text type='grey' center>Loading..</UI.Text>
                ) : (
                  <>
                    {/*<UI.Text type='grey' small>*/}
                    {/*  {moment.unix(lineData.date).format('HH:mm · D MMM, YY')}*/}
                    {/*</UI.Text>*/}
                    <Link
                      to={buildUrl(HUB_PROJECT_EXPERIMENT, {
                        experiment_name: run.experiment_name,
                        commit_id: run.run_hash,
                      })}
                    >
                      <UI.Text type='primary'>Detailed View</UI.Text>
                    </Link>
                    <UI.Line />
                    <UI.Text type='grey' small>Experiment: {run.experiment_name}</UI.Text>
                    <UI.Text type='grey' small>Hash: {run.run_hash}</UI.Text>
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
                          onClick={() => this.handleProcessKill(commitPopUpData.process.pid, run.run_hash, run.experiment_name)}
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
        {this.context.runs.isLoading
          ? (
            this.context.search.query.indexOf('tf:') === -1
              ? this._renderPanelMsg(<UI.Text type='grey' center>Loading..</UI.Text>)
              : this._renderPanelMsg(<UI.Text type='grey' center>Loading tf.summary logs can take some time..</UI.Text>)
          )
          : <>
            {this.context.runs.isEmpty
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