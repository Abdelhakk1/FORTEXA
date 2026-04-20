"use client";

import { useRef, useEffect } from "react";
import * as echarts from "echarts";

interface EChartProps {
  option: echarts.EChartsOption;
  height?: string;
  className?: string;
}

export function EChart({ option, height = "300px", className = "" }: EChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    
    chartInstance.current = echarts.init(chartRef.current);
    chartInstance.current.setOption(option);

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chartInstance.current?.dispose();
    };
  }, [option]);

  return <div ref={chartRef} style={{ height }} className={`w-full ${className}`} />;
}
