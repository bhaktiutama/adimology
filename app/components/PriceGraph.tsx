'use client';

import { useEffect, useRef, useState } from 'react';

interface PriceGraphProps {
  ticker: string;
}

export default function PriceGraph({ ticker }: PriceGraphProps) {
  const container = useRef<HTMLDivElement>(null);
  const [isLightTheme, setIsLightTheme] = useState(false);

  // Sync theme with document.body class
  useEffect(() => {
    const checkTheme = () => {
      setIsLightTheme(document.body.classList.contains('light-theme'));
    };

    // Initial check
    checkTheme();

    // Observe changes to document.body class
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          checkTheme();
        }
      });
    });

    observer.observe(document.body, { attributes: true });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!container.current) return;

    // Clean up previous widget if any
    container.current.innerHTML = '';

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    
    const widgetConfig = {
      "autosize": true,
      "symbol": `IDX:${ticker.toUpperCase()}`,
      "interval": "D",
      "timezone": "Asia/Jakarta",
      "theme": isLightTheme ? "light" : "dark",
      "style": "1",
      "locale": "en",
      "allow_symbol_change": true,
      "calendar": false,
      "details": true,
      "hide_side_toolbar": true,
      "hide_top_toolbar": false,
      "hide_legend": false,
      "hide_volume": false,
      "hotlist": false,
      "save_image": true,
      "watchlist": [],
      "withdateranges": true,
      "compareSymbols": [],
      "show_popup_button": true,
      "popup_height": "650",
      "popup_width": "1000",
      "studies": [
        "STD;MA%1Cross",
        "STD;RSI"
      ],
      "support_host": "https://www.tradingview.com",
      "backgroundColor": isLightTheme ? "#ffffff" : "#0F0F0F",
      "gridColor": isLightTheme ? "rgba(46, 46, 46, 0.06)" : "rgba(242, 242, 242, 0.06)"
    };

    script.innerHTML = JSON.stringify(widgetConfig);

    container.current.appendChild(script);
  }, [ticker, isLightTheme]);

  return (
    <div className="glass-card" style={{ 
      padding: '0', 
      overflow: 'hidden',
      height: '600px',
      border: isLightTheme ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.1)',
      background: isLightTheme ? '#ffffff' : '#0F0F0F',
      display: 'flex',
      flexDirection: 'column',
      transition: 'background-color 0.3s ease, border-color 0.3s ease'
    }}>
      <div style={{
        padding: '0.75rem 1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: isLightTheme ? '1px solid rgba(0, 0, 0, 0.05)' : '1px solid rgba(255, 255, 255, 0.05)',
        background: isLightTheme ? 'rgba(0, 0, 0, 0.02)' : 'rgba(0, 0, 0, 0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18"></path>
            <path d="m19 9-5 5-4-4-3 3"></path>
          </svg>
          <span style={{ 
            fontSize: '0.8rem', 
            fontWeight: 600, 
            color: isLightTheme ? 'var(--text-primary)' : '#fff', 
            textTransform: 'uppercase', 
            letterSpacing: '0.5px' 
          }}>
            Advanced Chart
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button 
            className="tradingview-btn"
            onClick={() => {
              const url = `https://www.tradingview.com/chart/acOC8yxo/?symbol=IDX_DLY%3A${ticker.toUpperCase()}`;
              window.open(url, 'TradingView', 'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no,directories=no,resizable=yes,scrollbars=yes');
            }}
            style={{ padding: '6px 12px', fontSize: '0.7rem' }}
            title="Open TradingView Chart"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            Trading View
          </button>

          <button 
            className="chartbit-btn"
            onClick={() => {
              const url = `https://stockbit.com/symbol/${ticker.toUpperCase()}/chartbit`;
              window.open(url, 'Chartbit', 'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no,directories=no,resizable=yes,scrollbars=yes');
            }}
            style={{ padding: '6px 12px', fontSize: '0.7rem' }}
            title="Open Stockbit Chartbit"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
            Chartbit
          </button>
        </div>
      </div>
      <div 
        id="tradingview_widget"
        ref={container}
        className="tradingview-widget-container" 
        style={{ flex: 1, width: "100%" }}
      >
        <div className="tradingview-widget-container__widget" style={{ height: "100%", width: "100%" }}></div>
      </div>
    </div>
  );
}
