/**
 * 機器學習策略優化器 (ML Strategy Optimizer)
 * 
 * 使用多種優化演算法來自動調整策略參數：
 * - 遺傳演算法 (Genetic Algorithm)
 * - 網格搜索 (Grid Search)
 * - 貝葉斯優化 (Bayesian Optimization)
 * - Walk-Forward 分析
 */

import { MarketData } from '../types';
import { StrategyType } from './botEngine';
import { BacktestEngine, BacktestConfig, BacktestResult, DEFAULT_BACKTEST_CONFIG } from './backtestEngine';

// 參數空間定義
export interface ParameterSpace {
  name: string;
  min: number;
  max: number;
  step: number;
  type: 'int' | 'float';
}

// 優化配置
export interface OptimizationConfig {
  strategy: StrategyType;
  parameterSpaces: ParameterSpace[];
  baseConfig: Partial<BacktestConfig>;
  
  // 優化目標
  objective: 'profit' | 'sharpe' | 'sortino' | 'winRate' | 'profitFactor' | 'custom';
  customObjective?: (result: BacktestResult) => number;
  
  // 演算法配置
  algorithm: 'genetic' | 'grid' | 'bayesian' | 'random';
  maxIterations: number;
  populationSize?: number;  // 遺傳演算法
  eliteRatio?: number;      // 保留頂尖比例
  mutationRate?: number;    // 突變率
  crossoverRate?: number;   // 交叉率
  
  // Walk-Forward 設定
  walkForward: boolean;
  trainRatio: number;       // 訓練集比例 (例如 0.7)
  windowSize: number;       // 滾動窗口大小 (K線數量)
  
  // 防止過擬合
  minTrades: number;        // 最少交易次數
  maxDrawdownLimit: number; // 最大回撤限制
}

// 優化結果
export interface OptimizationResult {
  bestParams: Record<string, number>;
  bestScore: number;
  bestResult: BacktestResult;
  
  // 所有迭代結果
  iterations: {
    iteration: number;
    params: Record<string, number>;
    score: number;
    inSampleResult?: BacktestResult;
    outOfSampleResult?: BacktestResult;
  }[];
  
  // Walk-Forward 結果
  walkForwardResults?: {
    window: number;
    trainResult: BacktestResult;
    testResult: BacktestResult;
    params: Record<string, number>;
  }[];
  
  // 統計
  totalIterations: number;
  convergenceHistory: number[];
  executionTime: number;
  
  // 穩健性分析
  robustnessScore: number;  // 0-100
  overfittingWarning: boolean;
}

// 個體 (用於遺傳演算法)
interface Individual {
  genes: Record<string, number>;
  fitness: number;
  result?: BacktestResult;
}

export class MLOptimizer {
  private config: OptimizationConfig;
  private data: MarketData[] = [];
  private bestIndividual: Individual | null = null;
  private convergenceHistory: number[] = [];
  private startTime: number = 0;

  constructor(config: OptimizationConfig) {
    this.config = config;
  }

  // 執行優化
  async optimize(data: MarketData[]): Promise<OptimizationResult> {
    this.data = data;
    this.startTime = Date.now();
    this.convergenceHistory = [];

    let result: OptimizationResult;

    switch (this.config.algorithm) {
      case 'genetic':
        result = await this.geneticOptimization();
        break;
      case 'grid':
        result = await this.gridSearch();
        break;
      case 'bayesian':
        result = await this.bayesianOptimization();
        break;
      case 'random':
        result = await this.randomSearch();
        break;
      default:
        result = await this.randomSearch();
    }

    // Walk-Forward 分析
    if (this.config.walkForward) {
      result.walkForwardResults = await this.walkForwardAnalysis(result.bestParams);
      result.robustnessScore = this.calculateRobustness(result);
      result.overfittingWarning = result.robustnessScore < 50;
    }

    result.executionTime = Date.now() - this.startTime;
    return result;
  }

  // 遺傳演算法優化
  private async geneticOptimization(): Promise<OptimizationResult> {
    const popSize = this.config.populationSize || 50;
    const eliteRatio = this.config.eliteRatio || 0.1;
    const mutationRate = this.config.mutationRate || 0.1;
    const crossoverRate = this.config.crossoverRate || 0.7;
    
    const iterations: OptimizationResult['iterations'] = [];
    
    // 初始化種群
    let population = this.initializePopulation(popSize);
    
    // 評估適應度
    population = await this.evaluatePopulation(population);
    population.sort((a, b) => b.fitness - a.fitness);
    
    this.bestIndividual = population[0];
    this.convergenceHistory.push(this.bestIndividual.fitness);

    // 進化迭代
    for (let gen = 0; gen < this.config.maxIterations; gen++) {
      const newPopulation: Individual[] = [];
      
      // 精英保留
      const eliteCount = Math.floor(popSize * eliteRatio);
      for (let i = 0; i < eliteCount; i++) {
        newPopulation.push({ ...population[i] });
      }
      
      // 生成新個體
      while (newPopulation.length < popSize) {
        // 錦標賽選擇
        const parent1 = this.tournamentSelection(population);
        const parent2 = this.tournamentSelection(population);
        
        let child: Individual;
        
        // 交叉
        if (Math.random() < crossoverRate) {
          child = this.crossover(parent1, parent2);
        } else {
          child = { ...parent1, fitness: 0 };
        }
        
        // 突變
        if (Math.random() < mutationRate) {
          child = this.mutate(child);
        }
        
        newPopulation.push(child);
      }
      
      // 評估新種群
      population = await this.evaluatePopulation(newPopulation);
      population.sort((a, b) => b.fitness - a.fitness);
      
      // 更新最佳個體
      if (population[0].fitness > this.bestIndividual.fitness) {
        this.bestIndividual = population[0];
      }
      
      this.convergenceHistory.push(this.bestIndividual.fitness);
      
      // 記錄迭代
      iterations.push({
        iteration: gen + 1,
        params: population[0].genes,
        score: population[0].fitness,
        inSampleResult: population[0].result
      });
      
      // 檢查收斂
      if (this.checkConvergence()) {
        break;
      }
    }

    return this.createOptimizationResult(iterations);
  }

  // 網格搜索
  private async gridSearch(): Promise<OptimizationResult> {
    const iterations: OptimizationResult['iterations'] = [];
    const allCombinations = this.generateGridCombinations();
    
    let bestScore = -Infinity;
    let bestParams: Record<string, number> = {};
    let bestResult: BacktestResult | null = null;

    for (let i = 0; i < Math.min(allCombinations.length, this.config.maxIterations); i++) {
      const params = allCombinations[i];
      const result = await this.runBacktest(params);
      const score = this.calculateFitness(result);
      
      if (score > bestScore) {
        bestScore = score;
        bestParams = params;
        bestResult = result;
      }
      
      this.convergenceHistory.push(bestScore);
      
      iterations.push({
        iteration: i + 1,
        params,
        score,
        inSampleResult: result
      });
    }

    this.bestIndividual = {
      genes: bestParams,
      fitness: bestScore,
      result: bestResult || undefined
    };

    return this.createOptimizationResult(iterations);
  }

  // 貝葉斯優化 (簡化版 - 使用隨機森林代理模型)
  private async bayesianOptimization(): Promise<OptimizationResult> {
    const iterations: OptimizationResult['iterations'] = [];
    const observedPoints: { params: Record<string, number>; score: number }[] = [];
    
    // 初始隨機探索
    const initialPoints = Math.min(10, this.config.maxIterations / 5);
    for (let i = 0; i < initialPoints; i++) {
      const params = this.generateRandomParams();
      const result = await this.runBacktest(params);
      const score = this.calculateFitness(result);
      
      observedPoints.push({ params, score });
      iterations.push({
        iteration: i + 1,
        params,
        score,
        inSampleResult: result
      });
    }
    
    // 貝葉斯優化循環
    for (let i = initialPoints; i < this.config.maxIterations; i++) {
      // 使用獲取函數選擇下一個點
      const nextParams = this.acquisitionFunction(observedPoints);
      const result = await this.runBacktest(nextParams);
      const score = this.calculateFitness(result);
      
      observedPoints.push({ params: nextParams, score });
      
      const bestScore = Math.max(...observedPoints.map(p => p.score));
      this.convergenceHistory.push(bestScore);
      
      iterations.push({
        iteration: i + 1,
        params: nextParams,
        score,
        inSampleResult: result
      });
    }
    
    // 找出最佳結果
    const best = observedPoints.reduce((a, b) => a.score > b.score ? a : b);
    const bestResult = await this.runBacktest(best.params);
    
    this.bestIndividual = {
      genes: best.params,
      fitness: best.score,
      result: bestResult
    };

    return this.createOptimizationResult(iterations);
  }

  // 隨機搜索
  private async randomSearch(): Promise<OptimizationResult> {
    const iterations: OptimizationResult['iterations'] = [];
    let bestScore = -Infinity;
    let bestParams: Record<string, number> = {};
    let bestResult: BacktestResult | null = null;

    for (let i = 0; i < this.config.maxIterations; i++) {
      const params = this.generateRandomParams();
      const result = await this.runBacktest(params);
      const score = this.calculateFitness(result);
      
      if (score > bestScore) {
        bestScore = score;
        bestParams = params;
        bestResult = result;
      }
      
      this.convergenceHistory.push(bestScore);
      
      iterations.push({
        iteration: i + 1,
        params,
        score,
        inSampleResult: result
      });
    }

    this.bestIndividual = {
      genes: bestParams,
      fitness: bestScore,
      result: bestResult || undefined
    };

    return this.createOptimizationResult(iterations);
  }

  // Walk-Forward 分析
  private async walkForwardAnalysis(bestParams: Record<string, number>): Promise<OptimizationResult['walkForwardResults']> {
    const results: OptimizationResult['walkForwardResults'] = [];
    const windowSize = this.config.windowSize;
    const trainRatio = this.config.trainRatio;
    
    const totalBars = this.data.length;
    const stepSize = Math.floor(windowSize * (1 - trainRatio));
    
    let windowStart = 0;
    let windowNum = 0;
    
    while (windowStart + windowSize <= totalBars) {
      const windowData = this.data.slice(windowStart, windowStart + windowSize);
      const trainSize = Math.floor(windowData.length * trainRatio);
      
      const trainData = windowData.slice(0, trainSize);
      const testData = windowData.slice(trainSize);
      
      // 在訓練集上優化
      const optimizer = new MLOptimizer({
        ...this.config,
        walkForward: false,
        maxIterations: Math.min(50, this.config.maxIterations)
      });
      
      const trainResult = await this.runBacktestWithData(bestParams, trainData);
      const testResult = await this.runBacktestWithData(bestParams, testData);
      
      results.push({
        window: windowNum + 1,
        trainResult,
        testResult,
        params: bestParams
      });
      
      windowStart += stepSize;
      windowNum++;
    }
    
    return results;
  }

  // 輔助方法

  private initializePopulation(size: number): Individual[] {
    const population: Individual[] = [];
    for (let i = 0; i < size; i++) {
      population.push({
        genes: this.generateRandomParams(),
        fitness: 0
      });
    }
    return population;
  }

  private generateRandomParams(): Record<string, number> {
    const params: Record<string, number> = {};
    for (const space of this.config.parameterSpaces) {
      const range = space.max - space.min;
      const steps = Math.floor(range / space.step);
      const randomStep = Math.floor(Math.random() * (steps + 1));
      let value = space.min + randomStep * space.step;
      
      if (space.type === 'int') {
        value = Math.round(value);
      }
      
      params[space.name] = value;
    }
    return params;
  }

  private generateGridCombinations(): Record<string, number>[] {
    const combinations: Record<string, number>[] = [];
    const spaces = this.config.parameterSpaces;
    
    const generateRecursive = (index: number, current: Record<string, number>) => {
      if (index === spaces.length) {
        combinations.push({ ...current });
        return;
      }
      
      const space = spaces[index];
      for (let value = space.min; value <= space.max; value += space.step) {
        current[space.name] = space.type === 'int' ? Math.round(value) : value;
        generateRecursive(index + 1, current);
      }
    };
    
    generateRecursive(0, {});
    return combinations;
  }

  private async evaluatePopulation(population: Individual[]): Promise<Individual[]> {
    for (const individual of population) {
      if (individual.fitness === 0 || !individual.result) {
        const result = await this.runBacktest(individual.genes);
        individual.result = result;
        individual.fitness = this.calculateFitness(result);
      }
    }
    return population;
  }

  private tournamentSelection(population: Individual[], tournamentSize: number = 3): Individual {
    let best: Individual | null = null;
    
    for (let i = 0; i < tournamentSize; i++) {
      const candidate = population[Math.floor(Math.random() * population.length)];
      if (!best || candidate.fitness > best.fitness) {
        best = candidate;
      }
    }
    
    return best!;
  }

  private crossover(parent1: Individual, parent2: Individual): Individual {
    const child: Individual = { genes: {}, fitness: 0 };
    
    for (const space of this.config.parameterSpaces) {
      // 均勻交叉
      child.genes[space.name] = Math.random() < 0.5 
        ? parent1.genes[space.name] 
        : parent2.genes[space.name];
    }
    
    return child;
  }

  private mutate(individual: Individual): Individual {
    const mutated = { ...individual, genes: { ...individual.genes }, fitness: 0 };
    
    // 隨機選擇一個參數進行突變
    const spaceIndex = Math.floor(Math.random() * this.config.parameterSpaces.length);
    const space = this.config.parameterSpaces[spaceIndex];
    
    // 高斯突變
    const currentValue = mutated.genes[space.name];
    const sigma = (space.max - space.min) * 0.1;
    let newValue = currentValue + this.gaussianRandom() * sigma;
    
    // 限制在範圍內
    newValue = Math.max(space.min, Math.min(space.max, newValue));
    
    // 對齊到步長
    newValue = space.min + Math.round((newValue - space.min) / space.step) * space.step;
    
    if (space.type === 'int') {
      newValue = Math.round(newValue);
    }
    
    mutated.genes[space.name] = newValue;
    
    return mutated;
  }

  private gaussianRandom(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  private acquisitionFunction(observed: { params: Record<string, number>; score: number }[]): Record<string, number> {
    // Expected Improvement (簡化版)
    // 生成候選點並選擇最有希望的
    const candidates: { params: Record<string, number>; ei: number }[] = [];
    const bestObserved = Math.max(...observed.map(o => o.score));
    
    for (let i = 0; i < 100; i++) {
      const params = this.generateRandomParams();
      
      // 簡單預測: 基於最近鄰的加權平均
      let predictedMean = 0;
      let totalWeight = 0;
      
      for (const point of observed) {
        const distance = this.calculateParamDistance(params, point.params);
        const weight = 1 / (distance + 0.001);
        predictedMean += point.score * weight;
        totalWeight += weight;
      }
      predictedMean /= totalWeight;
      
      // 估計不確定性 (基於距離)
      const minDistance = Math.min(...observed.map(p => this.calculateParamDistance(params, p.params)));
      const uncertainty = minDistance * 10;
      
      // Expected Improvement
      const z = (predictedMean - bestObserved) / (uncertainty + 0.001);
      const ei = uncertainty * (z * this.normalCDF(z) + this.normalPDF(z));
      
      candidates.push({ params, ei });
    }
    
    // 選擇 EI 最高的
    return candidates.reduce((a, b) => a.ei > b.ei ? a : b).params;
  }

  private calculateParamDistance(p1: Record<string, number>, p2: Record<string, number>): number {
    let sum = 0;
    for (const space of this.config.parameterSpaces) {
      const range = space.max - space.min;
      const diff = (p1[space.name] - p2[space.name]) / range;
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  private normalPDF(x: number): number {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  }

  private normalCDF(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);
    
    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    
    return 0.5 * (1 + sign * y);
  }

  private async runBacktest(params: Record<string, number>): Promise<BacktestResult> {
    return this.runBacktestWithData(params, this.data);
  }

  private async runBacktestWithData(params: Record<string, number>, data: MarketData[]): Promise<BacktestResult> {
    const config: BacktestConfig = {
      ...DEFAULT_BACKTEST_CONFIG,
      ...this.config.baseConfig,
      strategy: this.config.strategy,
      strategyParams: { ...params, signalThreshold: params.signalThreshold || 50 }
    };
    
    const engine = new BacktestEngine(config);
    return engine.run(data);
  }

  private calculateFitness(result: BacktestResult): number {
    // 檢查最低交易次數
    if (result.totalTrades < this.config.minTrades) {
      return -1000;
    }
    
    // 檢查最大回撤限制
    if (result.maxDrawdownPercent > this.config.maxDrawdownLimit) {
      return -500;
    }
    
    switch (this.config.objective) {
      case 'profit':
        return result.totalPnLPercent;
      case 'sharpe':
        return result.sharpeRatio;
      case 'sortino':
        return result.sortinoRatio;
      case 'winRate':
        return result.winRate;
      case 'profitFactor':
        return result.profitFactor;
      case 'custom':
        return this.config.customObjective ? this.config.customObjective(result) : 0;
      default:
        // 綜合評分
        return (
          result.totalPnLPercent * 0.3 +
          result.sharpeRatio * 20 +
          result.winRate * 0.2 +
          result.profitFactor * 10 -
          result.maxDrawdownPercent * 0.5
        );
    }
  }

  private checkConvergence(): boolean {
    if (this.convergenceHistory.length < 10) return false;
    
    // 檢查最近 10 代是否改善
    const recent = this.convergenceHistory.slice(-10);
    const improvement = recent[recent.length - 1] - recent[0];
    
    return Math.abs(improvement) < 0.01;
  }

  private calculateRobustness(result: OptimizationResult): number {
    if (!result.walkForwardResults || result.walkForwardResults.length === 0) {
      return 50;
    }
    
    // 計算樣本外表現與樣本內表現的比率
    let totalInSample = 0;
    let totalOutOfSample = 0;
    
    for (const wf of result.walkForwardResults) {
      totalInSample += wf.trainResult.totalPnLPercent;
      totalOutOfSample += wf.testResult.totalPnLPercent;
    }
    
    const avgInSample = totalInSample / result.walkForwardResults.length;
    const avgOutOfSample = totalOutOfSample / result.walkForwardResults.length;
    
    if (avgInSample <= 0) return 0;
    
    const ratio = avgOutOfSample / avgInSample;
    
    // 比率接近 1 表示穩健，> 1 表示非常好，< 0.5 表示過擬合
    return Math.min(100, Math.max(0, ratio * 100));
  }

  private createOptimizationResult(iterations: OptimizationResult['iterations']): OptimizationResult {
    return {
      bestParams: this.bestIndividual?.genes || {},
      bestScore: this.bestIndividual?.fitness || 0,
      bestResult: this.bestIndividual?.result || {} as BacktestResult,
      iterations,
      totalIterations: iterations.length,
      convergenceHistory: this.convergenceHistory,
      executionTime: Date.now() - this.startTime,
      robustnessScore: 50,
      overfittingWarning: false
    };
  }
}

// 預定義的策略參數空間
export const STRATEGY_PARAMETER_SPACES: Record<StrategyType, ParameterSpace[]> = {
  'MACD_TREND': [
    { name: 'signalThreshold', min: 30, max: 80, step: 5, type: 'int' },
    { name: 'fastPeriod', min: 8, max: 16, step: 1, type: 'int' },
    { name: 'slowPeriod', min: 20, max: 30, step: 1, type: 'int' }
  ],
  'RSI_REVERSAL': [
    { name: 'signalThreshold', min: 30, max: 80, step: 5, type: 'int' },
    { name: 'period', min: 10, max: 20, step: 1, type: 'int' },
    { name: 'oversold', min: 20, max: 35, step: 1, type: 'int' },
    { name: 'overbought', min: 65, max: 80, step: 1, type: 'int' }
  ],
  'BOLLINGER_BREAKOUT': [
    { name: 'signalThreshold', min: 30, max: 80, step: 5, type: 'int' },
    { name: 'period', min: 15, max: 25, step: 1, type: 'int' },
    { name: 'stdDev', min: 1.5, max: 3, step: 0.1, type: 'float' }
  ],
  'MA_CROSSOVER': [
    { name: 'signalThreshold', min: 30, max: 80, step: 5, type: 'int' },
    { name: 'fastPeriod', min: 5, max: 12, step: 1, type: 'int' },
    { name: 'slowPeriod', min: 20, max: 35, step: 1, type: 'int' }
  ],
  'GRID_TRADING': [
    { name: 'gridLevels', min: 5, max: 20, step: 1, type: 'int' },
    { name: 'gridSpacing', min: 0.5, max: 2, step: 0.1, type: 'float' }
  ]
};

// 預設優化配置
export const DEFAULT_OPTIMIZATION_CONFIG: Partial<OptimizationConfig> = {
  objective: 'sharpe',
  algorithm: 'genetic',
  maxIterations: 100,
  populationSize: 30,
  eliteRatio: 0.1,
  mutationRate: 0.15,
  crossoverRate: 0.7,
  walkForward: true,
  trainRatio: 0.7,
  windowSize: 500,
  minTrades: 10,
  maxDrawdownLimit: 30
};

export default MLOptimizer;
