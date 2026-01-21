// 分辨率类型
export type Resolution = '1d' | '1h' | '1m' | '30s';

// 分辨率对应的时间间隔（毫秒）
export const RESOLUTION_INTERVALS: Record<Resolution, number> = {
  '1d': 24 * 60 * 60 * 1000,     // 1天
  '1h': 60 * 60 * 1000,          // 1小时
  '1m': 60 * 1000,               // 1分钟
  '30s': 30 * 1000               // 30秒
};

export interface MetricPoint {
  t: number; // 时间戳（ms）
  [metric: string]: number;
}

export interface MetricsResponse {
  step: Resolution;
  points: MetricPoint[];
}

// 生成随机值，支持指定范围和波动
const generateRandomValue = (base: number = 50, range: number = 30, volatility: number = 0.1): number => {
  return Math.max(0, Math.min(100, base + (Math.random() - 0.5) * range + (Math.random() - 0.5) * volatility * range));
};

// 根据分辨率计算数据点数量
const getPointCount = (start: number, end: number, resolution: Resolution): number => {
  const duration = end - start;
  switch (resolution) {
    case '30s':
      return Math.ceil(duration / RESOLUTION_INTERVALS['30s']);
    case '1m':
      return Math.ceil(duration / RESOLUTION_INTERVALS['1m']);
    case '1h':
      return Math.ceil(duration / RESOLUTION_INTERVALS['1h']);
    case '1d':
      return Math.ceil(duration / RESOLUTION_INTERVALS['1d']);
  }
};

// 生成指定分辨率的数据
export const generateDataByResolution = (resolution: Resolution, start?: number, end?: number, metrics?: string[]): MetricsResponse => {
  const now = Date.now();
  const defaultMetrics = metrics || ['cpu_1', 'cpu_2', 'cpu_3', 'gpu_1', 'gpu_2', 'memory'];
  
  // 默认时间范围（最近一年）
  const defaultStart = now - 365 * 24 * 60 * 60 * 1000;
  const startTime = start || defaultStart;
  const endTime = end || now;
  
  // 计算数据点数量，限制最大点数
  let pointCount = getPointCount(startTime, endTime, resolution);
  pointCount = Math.min(pointCount, 10000); // 确保渲染点数 < 10,000
  
  // 生成基础值
  const baseValues: Record<string, number> = {};
  defaultMetrics.forEach(metric => {
    if (metric.startsWith('cpu')) {
      baseValues[metric] = 30 + Math.random() * 20;
    } else if (metric.startsWith('gpu')) {
      baseValues[metric] = 40 + Math.random() * 30;
    } else if (metric === 'memory') {
      baseValues[metric] = 60 + Math.random() * 20;
    } else {
      baseValues[metric] = 50 + Math.random() * 30;
    }
  });
  
  // 生成数据点
  const points: MetricPoint[] = [];
  const interval = (endTime - startTime) / (pointCount - 1 || 1);
  
  for (let i = 0; i < pointCount; i++) {
    const timestamp = Math.round(startTime + i * interval);
    const point: MetricPoint = { t: timestamp };
    
    defaultMetrics.forEach(metric => {
      let range = 15;
      if (metric.startsWith('cpu')) {
        range = metric === 'cpu_1' ? 10 : metric === 'cpu_2' ? 8 : 12;
      } else if (metric.startsWith('gpu')) {
        range = metric === 'gpu_1' ? 15 : 12;
      } else if (metric === 'memory') {
        range = 8;
      }
      point[metric] = parseFloat(generateRandomValue(baseValues[metric], range, 0.1).toFixed(1));
    });
    
    points.push(point);
  }
  
  return {
    step: resolution,
    points
  };
};

// 模拟后端API调用
export const fetchMetrics = async (start: number, end: number, metrics: string[], resolution: Resolution): Promise<MetricsResponse> => {
  // 模拟网络延迟
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
  return generateDataByResolution(resolution, start, end, metrics);
};

// 分辨率判定规则
export const getResolutionForRange = (start: number, end: number): Resolution => {
  const duration = end - start;
  const durationInYears = duration / (365 * 24 * 60 * 60 * 1000);
  const durationInMonths = duration / (30 * 24 * 60 * 60 * 1000);
  const durationInDays = duration / (24 * 60 * 60 * 1000);
  const durationInHours = duration / (60 * 60 * 1000);
  const durationInMinutes = duration / (60 * 1000);
  
  console.log('Duration:', {
    years: durationInYears,
    months: durationInMonths,
    days: durationInDays,
    hours: durationInHours,
    minutes: durationInMinutes
  });
  
  if (durationInYears >= 1) { // ≥ 1年
    return '1d'; // 全年：每天一个点
  } else if (durationInMonths >= 1) { // 1个月 ~ 1年
    return '1h'; // 月：每小时一个点
  } else if (durationInDays >= 1) { // 1天 ~ 1个月
    return '1m'; // 天：每分钟一个点
  } else if (durationInHours >= 1) { // 1小时 ~ 1天
    return '1m'; // 小时：每分钟一个点
  } else {
    return '30s'; // < 1小时：每30秒一个点
  }
};

// 生成初始数据（用于首屏加载）
export const generateInitialData = (): MetricsResponse => {
  // 默认生成最近一年的数据，使用天分辨率，每天一个点
  const now = Date.now();
  const start = now - 365 * 24 * 60 * 60 * 1000;
  return generateDataByResolution('1d', start, now);
};