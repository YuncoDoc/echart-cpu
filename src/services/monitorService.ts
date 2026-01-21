import { fetchMetrics, generateInitialData, getResolutionForRange, generateDataByResolution } from '../utils/monitorData';
import type { Resolution, MetricsResponse } from '../utils/monitorData';

// 数据缓存，避免重复请求
type DataCacheKey = string;
type DataCache = Record<DataCacheKey, MetricsResponse>;

class MonitorService {
  private cache: DataCache = {};
  private cacheExpiry: Record<DataCacheKey, number> = {};
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存

  // 生成缓存键
  private generateCacheKey(start: number, end: number, resolution: Resolution, metrics: string[]): string {
    return `${start}-${end}-${resolution}-${metrics.sort().join(',')}`;
  }

  // 获取数据，优先使用缓存
  async getData(start: number, end: number, metrics: string[]): Promise<MetricsResponse> {
    const resolution = getResolutionForRange(start, end);
    const cacheKey = this.generateCacheKey(start, end, resolution, metrics);
    const now = Date.now();
    
    // 检查缓存是否有效
    if (this.cache[cacheKey] && now - this.cacheExpiry[cacheKey] < this.CACHE_DURATION) {
      return this.cache[cacheKey];
    }

    try {
      // 请求新数据
      const data = await fetchMetrics(start, end, metrics, resolution);
      
      // 更新缓存
      this.cache[cacheKey] = data;
      this.cacheExpiry[cacheKey] = now;
      
      return data;
    } catch (error) {
      console.error('Failed to fetch monitor data:', error);
      // 缓存失效时生成对应分辨率的数据，保证系统可用性
      return generateDataByResolution(resolution, start, end, metrics);
    }
  }

  // 获取初始数据（用于首屏加载）
  getInitialData(): MetricsResponse {
    return generateInitialData();
  }

  // 清除特定缓存
  clearCache(start?: number, end?: number, resolution?: Resolution, metrics?: string[]): void {
    if (start && end && resolution && metrics) {
      const cacheKey = this.generateCacheKey(start, end, resolution, metrics);
      delete this.cache[cacheKey];
      delete this.cacheExpiry[cacheKey];
    } else {
      // 清除所有缓存
      this.cache = {};
      this.cacheExpiry = {};
    }
  }

  // 确定分辨率
  getResolution(start: number, end: number): Resolution {
    return getResolutionForRange(start, end);
  }
}

// 导出单例实例
export const monitorService = new MonitorService();
