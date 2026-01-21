import './App.css';
import MonitorChart from './components/MonitorChart';
import { useState } from 'react';

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  return (
    <div className={`app-container ${theme}`}>
      <header className="app-header">
        <div className="header-content">
          <div>
            <h1>系统监控面板</h1>
            <p>实时监控系统资源使用率，支持缩放和多时间粒度查看</p>
          </div>
          <button 
            className="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label="切换主题"
          >
            {theme === 'light' ? '🌙 暗黑模式' : '☀️ 明亮模式'}
          </button>
        </div>
      </header>
      <main className="charts-container">
        <div className="chart-item">
          <MonitorChart 
            title="系统资源综合监控" 
            initialMetrics={['cpu_1', 'cpu_2', 'cpu_3', 'gpu_1', 'gpu_2']}
            theme={theme}
          />
        </div>
        <div className="chart-item">
          <MonitorChart 
            title="CPU 核心监控" 
            initialMetrics={['cpu_1', 'cpu_2', 'cpu_3']}
            theme={theme}
          />
        </div>
        <div className="chart-item">
          <MonitorChart 
            title="GPU 详细监控" 
            initialMetrics={['gpu_1', 'gpu_2']}
            theme={theme}
          />
        </div>
        <div className="chart-item">
          <MonitorChart 
            title="内存与存储监控" 
            initialMetrics={['memory', 'disk']}
            theme={theme}
          />
        </div>
      </main>
      <footer className="app-footer">
        <p>© 2024 系统监控面板 | 支持鼠标滚轮缩放和拖拽 | 每30秒更新一次数据</p>
      </footer>
    </div>
  );
}

export default App;