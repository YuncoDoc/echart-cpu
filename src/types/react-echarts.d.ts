declare module 'react-echarts' {
  import { EChartsOption } from 'echarts';
  
  interface ReactEChartsProps {
    option: EChartsOption;
    style?: React.CSSProperties;
    className?: string;
    notMerge?: boolean;
    lazyUpdate?: boolean;
    theme?: string | object;
    onChartReady?: (chart: any) => void;
    onEvents?: Record<string, (params: any) => void>;
    opts?: any;
  }
  
  const ReactECharts: React.FC<ReactEChartsProps>;
  
  export default ReactECharts;
}