import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as echarts from 'echarts';
import type { Resolution, MetricsResponse } from '../utils/monitorData';
import { monitorService } from '../services/monitorService';

interface MonitorChartProps {
  title: string;
  initialMetrics?: string[];
  theme?: 'light' | 'dark';
}

const MonitorChart: React.FC<MonitorChartProps> = ({ 
  title, 
  initialMetrics = ['cpu_1', 'cpu_2', 'cpu_3', 'gpu_1', 'gpu_2'],
  theme = 'light'
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<echarts.ECharts | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  
  // 状态管理
  const [metrics] = useState<string[]>(initialMetrics);
  const [loading, setLoading] = useState<boolean>(false);
  const [visibleMetrics, setVisibleMetrics] = useState<string[]>(initialMetrics);
  const [lowResData, setLowResData] = useState<MetricsResponse | null>(null);
  const [highResData, setHighResData] = useState<MetricsResponse | null>(null);
  const [activeResolution, setActiveResolution] = useState<Resolution>('1h');

  // 图表颜色配置
  const metricColors: Record<string, string> = {
    cpu_1: '#5470c6',
    cpu_2: '#91cc75',
    cpu_3: '#fac858',
    gpu_1: '#ee6666',
    gpu_2: '#73c0de',
    memory: '#3ba272',
    disk: '#fc8452',
    network: '#9a60b4'
  };

  // 防抖函数
  const debounce = (func: () => void, delay: number) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(func, delay);
  };

  // 获取数据
  const loadData = useCallback(async (start: number, end: number) => {
    setLoading(true);
    try {
      console.log('Loading data for range:', { start, end });
      const data = await monitorService.getData(start, end, metrics);
      console.log('Received data with resolution:', data.step);
      
      // 根据分辨率决定使用低分辨率还是高分辨率series
      if (data.step === '1d' || data.step === '1h') {
        // 低分辨率数据（天、小时）
        setLowResData(data);
        setHighResData(null);
        setActiveResolution(data.step);
        console.log(`Set resolution to ${data.step}`);
      } else {
        // 高分辨率数据（分钟、30秒）
        setHighResData(data);
        setLowResData(null);
        setActiveResolution(data.step);
        console.log(`Set resolution to ${data.step}`);
      }
    } catch (error) {
      console.error('Failed to load monitor data:', error);
    } finally {
      setLoading(false);
    }
  }, [metrics]);

  // 初始化和更新图表
  useEffect(() => {
    if (!chartRef.current) return;

    // 初始化图表实例
    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartRef.current, theme, {
        renderer: 'canvas',
        useDirtyRect: true,
        devicePixelRatio: window.devicePixelRatio * 0.8
      });

      // 注册缩放事件
      chartInstanceRef.current.on('dataZoom', (params: any) => {
        let startValue: number;
        let endValue: number;
        
        // 处理不同类型的数据缩放事件
        if (params.batch) {
          // 批量缩放事件（如拖动滚动条）
          const zoomRange = params.batch[0];
          
          if (typeof zoomRange.startValue === 'number') {
            // 时间戳类型
            startValue = zoomRange.startValue;
            endValue = zoomRange.endValue;
          } else {
            // 百分比类型，需要转换为实际时间范围
            const option = chartInstanceRef.current?.getOption() as any;
            if (option && option.xAxis && option.xAxis[0]) {
              const xAxis = option.xAxis[0];
              if (xAxis.min && xAxis.max) {
                const totalRange = xAxis.max - xAxis.min;
                startValue = xAxis.min + (totalRange * zoomRange.start / 100);
                endValue = xAxis.min + (totalRange * zoomRange.end / 100);
              } else {
                return;
              }
            } else {
              return;
            }
          }
        } else if (params.start && params.end) {
          // 单个缩放事件（如鼠标滚轮缩放）
          const option = chartInstanceRef.current?.getOption() as any;
          if (option && option.xAxis && option.xAxis[0]) {
            const xAxis = option.xAxis[0];
            if (xAxis.min && xAxis.max) {
              const totalRange = xAxis.max - xAxis.min;
              startValue = xAxis.min + (totalRange * params.start / 100);
              endValue = xAxis.min + (totalRange * params.end / 100);
            } else {
              return;
            }
          } else {
            return;
          }
        } else {
          // 无法处理的事件类型
          return;
        }
        
        console.log('Zoom range:', { startValue, endValue });
        
        // 防抖处理，避免频繁请求
        debounce(() => {
          if (startValue && endValue) {
            loadData(startValue, endValue);
          }
        }, 200);
      });

      // 注册图例事件
      chartInstanceRef.current.on('legendselectchanged', (params: any) => {
        // 更新可见指标
        const newVisibleMetrics: string[] = [];
        for (const [metric, selected] of Object.entries(params.selected)) {
          if (selected) {
            newVisibleMetrics.push(metric.toLowerCase());
          }
        }
        setVisibleMetrics(newVisibleMetrics);
      });
    }

    // 自适应数据采样函数
    const sampleData = (data: number[][], maxPoints: number = 500): number[][] => {
      if (data.length <= maxPoints) {
        return data;
      }
      
      const step = Math.ceil(data.length / maxPoints);
      const sampledData: number[][] = [];
      
      for (let i = 0; i < data.length; i += step) {
        sampledData.push(data[i]);
      }
      
      // 确保包含最后一个数据点
      if (sampledData[sampledData.length - 1][0] !== data[data.length - 1][0]) {
        sampledData.push(data[data.length - 1]);
      }
      
      return sampledData;
    };
    
    // 计算最大数据点数量（基于图表宽度，大约每像素1个点）
    const chartWidth = chartRef.current?.offsetWidth || 800;
    const maxPoints = Math.min(1000, Math.max(200, chartWidth));
    
    // 准备图表配置
    const option: echarts.EChartsOption = {
      title: {
        text: title,
        left: 'center',
        textStyle: {
          color: theme === 'dark' ? '#fff' : '#333',
          fontSize: 16,
          fontWeight: 700
        }
      },
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: {
          type: 'cross' as const,
          label: {
            backgroundColor: theme === 'dark' ? '#333' : '#6a7985',
            color: theme === 'dark' ? '#fff' : '#fff'
          }
        },
        backgroundColor: theme === 'dark' ? '#2c3e50' : 'rgba(255, 255, 255, 0.95)',
        borderColor: theme === 'dark' ? '#444' : '#ddd',
        textStyle: {
          color: theme === 'dark' ? '#fff' : '#333'
        },
        formatter: (params: any) => {
          let result = '';
          params.forEach((param: any) => {
            // 确保只显示百分比，不显示时间戳
            const value = Array.isArray(param.value) ? param.value[1] : param.value;
            result += `${param.marker} ${param.seriesName}: ${value}%<br/>`;
          });
          return result;
        },
        // 限制tooltip在图表区域内显示，避免被遮挡
        confine: true,
        // 调整tooltip位置，避免遮挡
        position: 'top',
        // 增加tooltip的z-index，确保显示在最上层
        z: 1000
      },
      legend: {
        data: metrics.map(m => m.toUpperCase()),
        top: 30,
        textStyle: {
          color: theme === 'dark' ? '#ddd' : '#666'
        },
        backgroundColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.1)' : 'transparent',
        borderColor: theme === 'dark' ? '#444' : 'transparent',
        borderRadius: 6,
        padding: 8,
        selected: metrics.reduce((acc, metric) => {
          acc[metric.toUpperCase()] = true;
          return acc;
        }, {} as Record<string, boolean>)
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        containLabel: true
      },
      // 缩放组件
      dataZoom: [
        {
          type: 'inside' as const,
          start: 0,
          end: 100,
          zoomLock: false,
          throttle: 100,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          preventDefaultMouseMove: true
        },
        {
          start: 0,
          end: 100,
          height: 20,
          bottom: '3%',
          backgroundColor: theme === 'dark' ? '#333' : 'transparent',
          fillerColor: theme === 'dark' ? 'rgba(84, 112, 198, 0.3)' : 'rgba(84, 112, 198, 0.2)',
          borderColor: theme === 'dark' ? '#555' : '#5470c6',
          handleStyle: {
            color: '#5470c6',
            shadowBlur: 3,
            shadowColor: 'rgba(0, 0, 0, 0.2)',
            shadowOffsetX: 2,
            shadowOffsetY: 2
          },
          textStyle: {
            color: theme === 'dark' ? '#ddd' : '#666'
          }
        }
      ],
      xAxis: {
        type: 'time' as const,
        axisLine: {
          lineStyle: {
            color: theme === 'dark' ? '#555' : '#ccc'
          }
        },
        axisLabel: {
          color: theme === 'dark' ? '#ddd' : '#666',
          fontSize: 10,
          rotate: 45,
          interval: 'auto',
          formatter: (value: number) => {
            const date = new Date(value);
            // 根据分辨率自动调整时间格式
            if (activeResolution === '1d') {
              return `${date.getMonth() + 1}/${date.getDate()}`;
            } else if (activeResolution === '1h') {
              return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:00`;
            } else {
              return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
            }
          }
        },
        splitLine: {
          show: false
        },
        // 避免标签重叠
        axisTick: {
          show: true
        }
      },
      yAxis: {
        type: 'value' as const,
        min: 0,
        max: 100,
        axisLine: {
          lineStyle: {
            color: theme === 'dark' ? '#555' : '#ccc'
          }
        },
        axisLabel: {
          color: theme === 'dark' ? '#ddd' : '#666',
          formatter: '{value}%'
        },
        splitLine: {
          lineStyle: {
            color: theme === 'dark' ? '#444' : '#f0f0f0'
          }
        }
      },
      series: [
        // 低分辨率 series（1h）
        ...(lowResData ? metrics.map(metric => {
          const rawData = lowResData.points.map(point => [point.t, point[metric] || 0]);
          const sampledData = sampleData(rawData, maxPoints);
          
          return {
            name: metric.toUpperCase(),
            type: 'line' as const,
            data: sampledData,
            smooth: true,
            symbol: 'none' as const,
            sampling: 'lttb' as const,
            lineStyle: {
              color: metricColors[metric] || '#ccc',
              width: 2
            },
            areaStyle: {
              color: {
                type: 'linear' as const,
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [{
                  offset: 0, color: (metricColors[metric] || '#ccc') + (theme === 'dark' ? '20' : '30')
                }, {
                  offset: 1, color: (metricColors[metric] || '#ccc') + (theme === 'dark' ? '05' : '05')
                }]
              }
            },
            // 透明度控制，实现平滑切换
            opacity: activeResolution === '1h' ? 1 : 0,
            // 性能优化配置
            showSymbol: false,
            animation: false,
            large: true,
            progressive: 500,
            progressiveThreshold: 1000,
            // 控制可见性
            silent: !visibleMetrics.includes(metric)
          };
        }) : []),
        // 高分辨率 series（5m 或 30s）
        ...(highResData ? metrics.map(metric => {
          const rawData = highResData.points.map(point => [point.t, point[metric] || 0]);
          const sampledData = sampleData(rawData, maxPoints);
          
          return {
            name: metric.toUpperCase(),
            type: 'line' as const,
            data: sampledData,
            smooth: true,
            symbol: 'none' as const,
            sampling: 'lttb' as const,
            lineStyle: {
              color: metricColors[metric] || '#ccc',
              width: 2
            },
            areaStyle: {
              color: {
                type: 'linear' as const,
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [{
                  offset: 0, color: (metricColors[metric] || '#ccc') + (theme === 'dark' ? '20' : '30')
                }, {
                  offset: 1, color: (metricColors[metric] || '#ccc') + (theme === 'dark' ? '05' : '05')
                }]
              }
            },
            // 透明度控制，实现平滑切换
            opacity: activeResolution !== '1h' ? 1 : 0,
            // 性能优化配置
            showSymbol: false,
            animation: false,
            large: true,
            progressive: 500,
            progressiveThreshold: 1000,
            // 控制可见性
            silent: !visibleMetrics.includes(metric)
          };
        }) : [])
      ],
      // 加载动画
      loadingOption: {
        text: '加载中...',
        textColor: theme === 'dark' ? '#ddd' : '#999',
        maskColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
        zlevel: 0
      },
      // 背景色
      backgroundColor: 'transparent'
    };

    // 设置图表选项，不使用 notMerge: true，避免闪屏
    chartInstanceRef.current?.setOption(option, {
      notMerge: false,
      lazyUpdate: true
    });

    // 设置加载状态
    if (loading) {
      chartInstanceRef.current?.showLoading();
    } else {
      chartInstanceRef.current?.hideLoading();
    }

  }, [title, metrics, theme, loading, lowResData, highResData, activeResolution, visibleMetrics, loadData]);

  // 初始加载数据
  useEffect(() => {
    const initialData = monitorService.getInitialData();
    setLowResData(initialData);
    setActiveResolution(initialData.step);
  }, []);

  // 处理主题变化
  useEffect(() => {
    if (chartInstanceRef.current) {
      // 销毁现有图表实例
      chartInstanceRef.current.dispose();
      chartInstanceRef.current = null;
      // 触发数据重新加载，确保新图表有数据
      const initialData = monitorService.getInitialData();
      setLowResData(initialData);
      setHighResData(null);
      setActiveResolution('1h');
    }
  }, [theme]);

  // 处理窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      chartInstanceRef.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    // 清理函数
    return () => {
      window.removeEventListener('resize', handleResize);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      chartInstanceRef.current?.dispose();
      chartInstanceRef.current = null;
    };
  }, []);

  // 重置缩放
  const handleResetZoom = () => {
    chartInstanceRef.current?.dispatchAction({
      type: 'dataZoom',
      start: 0,
      end: 100
    });
    // 重置到初始状态
    const initialData = monitorService.getInitialData();
    setLowResData(initialData);
    setHighResData(null);
    setActiveResolution('1h');
  };

  return (
    <div className={`chart-container ${theme === 'dark' ? 'dark-theme' : ''}`}>
      <div className="chart-header">
        <h3>{title}</h3>
        <button 
          className="reset-zoom-btn"
          onClick={handleResetZoom}
          disabled={loading}
        >
          重置缩放
        </button>
      </div>
      <div ref={chartRef} className="chart-canvas" style={{ height: '400px', width: '100%' }} />
      <div className="chart-footer">
        <div className="granularity-info">
          当前分辨率: <strong>{activeResolution}</strong>
        </div>
        <div className="metric-legend">
          {metrics.map(metric => (
            <span key={metric} className="legend-item">
              <span 
                className="legend-color" 
                style={{ 
                  backgroundColor: metricColors[metric],
                  opacity: visibleMetrics.includes(metric) ? 1 : 0.5
                }} 
              />
              {metric.startsWith('cpu_') ? `CPU ${metric.split('_')[1]}` : 
               metric.startsWith('gpu_') ? `GPU ${metric.split('_')[1]}` : 
               metric.toUpperCase()}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MonitorChart;