import { ChangeDetectionStrategy, Component, signal, WritableSignal, computed, OnDestroy, OnInit } from '@angular/core';

export interface Card {
  id: number;
  icon: string;
  colorClass: string;
  isFlipped: boolean;
  isMatched: boolean;
  isError: boolean;
  isSuccess: boolean;
}

export interface DifficultyConfig {
  id: 'easy' | 'medium' | 'hard';
  name: string;
  desc: string;
  pairs: number;
  multiplier: number;
  gridClass: string;
  containerClass: string;
}

export interface GameRecord {
  id: string;
  playerName: string;
  difficultyId: string;
  difficultyName: string;
  score: number;
  time: number;
  flipCount: number;
  date: string;
}

export interface GameStats {
  gamesPlayed: number;
  totalTime: number;
  totalScore: number;
  bestTime: Record<string, number | null>;
  bestScore: Record<string, number | null>;
  bestFlips: Record<string, number | null>;
}

const DIFFICULTIES: DifficultyConfig[] = [
  { id: 'easy', name: '簡單', desc: '4x4 網格 (16張卡片)', pairs: 8, multiplier: 1, gridClass: 'grid-cols-4', containerClass: 'max-w-md' },
  { id: 'medium', name: '中等', desc: '6x4 網格 (24張卡片)', pairs: 12, multiplier: 1.5, gridClass: 'grid-cols-4 sm:grid-cols-6', containerClass: 'max-w-2xl' },
  { id: 'hard', name: '困難', desc: '6x6 網格 (36張卡片)', pairs: 18, multiplier: 2, gridClass: 'grid-cols-4 sm:grid-cols-6', containerClass: 'max-w-2xl' }
];

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnDestroy {
  allIcons = [
    'favorite', 'star', 'pets', 'local_florist', 'music_note', 'sunny', 'bedtime', 'anchor',
    'rocket', 'ac_unit', 'cake', 'camera_alt', 'directions_car', 'flight', 'headset', 'lunch_dining',
    'sports_esports', 'palette', 'watch', 'umbrella', 'school', 'emoji_nature'
  ];

  iconColors = [
    'text-red-500', 'text-blue-500', 'text-green-500', 'text-yellow-500',
    'text-purple-500', 'text-pink-500', 'text-indigo-500', 'text-teal-500',
    'text-orange-500', 'text-cyan-500', 'text-lime-500', 'text-fuchsia-500',
    'text-rose-500', 'text-emerald-500', 'text-sky-500', 'text-violet-500',
    'text-amber-500', 'text-red-400'
  ];
  
  difficulties: DifficultyConfig[] = DIFFICULTIES;
  selectedDifficulty = signal<DifficultyConfig>(DIFFICULTIES[0]);
  gameState = signal<'menu' | 'playing' | 'leaderboard'>('menu');

  playerNameInput = signal<string>('');
  records = signal<GameRecord[]>([]);
  stats = signal<GameStats>({
    gamesPlayed: 0,
    totalTime: 0,
    totalScore: 0,
    bestTime: { easy: null, medium: null, hard: null },
    bestScore: { easy: null, medium: null, hard: null },
    bestFlips: { easy: null, medium: null, hard: null },
  });
  hasSavedRecord = signal<boolean>(false);
  leaderboardTab = signal<string>('easy');

  cards: WritableSignal<Card[]> = signal([]);
  flippedIndices: number[] = [];
  isProcessing = false;
  
  // 新增狀態
  score = signal(0);
  flipCount = signal(0);
  elapsedSeconds = signal(0);
  
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  
  isGameComplete = computed(() => {
    const currentCards = this.cards();
    return currentCards.length > 0 && currentCards.every(c => c.isMatched);
  });

  formattedTime = computed(() => {
    return this.formatTime(this.elapsedSeconds());
  });

  averageTime = computed(() => {
    const st = this.stats();
    if (st.gamesPlayed === 0) return 0;
    return Math.round(st.totalTime / st.gamesPlayed);
  });

  averageScore = computed(() => {
    const st = this.stats();
    if (st.gamesPlayed === 0) return 0;
    return Math.round(st.totalScore / st.gamesPlayed);
  });

  topRecords = computed(() => {
    return this.records()
      .filter(r => r.difficultyId === this.leaderboardTab())
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.time !== b.time) return a.time - b.time;
        return a.flipCount - b.flipCount;
      })
      .slice(0, 10);
  });

  selectedTabConfig = computed(() => {
    return this.difficulties.find(d => d.id === this.leaderboardTab());
  });

  constructor() {
    // wait for user to start the game
  }

  ngOnInit() {
    this.loadData();
  }

  ngOnDestroy() {
    this.stopTimer();
  }

  stopTimer() {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  startTimer() {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      this.elapsedSeconds.update(s => s + 1);
    }, 1000);
  }

  startGame(difficulty: DifficultyConfig) {
    this.selectedDifficulty.set(difficulty);
    this.gameState.set('playing');
    this.initGame();
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  loadData() {
    try {
      const recordsStr = localStorage.getItem('memory_game_records');
      if (recordsStr) {
        this.records.set(JSON.parse(recordsStr));
      }
      const statsStr = localStorage.getItem('memory_game_stats');
      if (statsStr) {
        this.stats.set(JSON.parse(statsStr));
      }
    } catch (e) {
      console.error('Failed to load local storage', e);
    }
  }

  saveData() {
    try {
      localStorage.setItem('memory_game_records', JSON.stringify(this.records()));
      localStorage.setItem('memory_game_stats', JSON.stringify(this.stats()));
    } catch (e) {
      console.error('Failed to save to local storage', e);
    }
  }

  showLeaderboard() {
    this.gameState.set('leaderboard');
  }

  updatePlayerNameInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.playerNameInput.set(target.value);
  }

  saveRecord(playerName: string) {
    if (this.hasSavedRecord() || !this.isGameComplete()) return;
    const name = playerName.trim() || '匿名玩家';
    
    const newRecord: GameRecord = {
      id: Date.now().toString(),
      playerName: name,
      difficultyId: this.selectedDifficulty().id,
      difficultyName: this.selectedDifficulty().name,
      score: this.score(),
      time: this.elapsedSeconds(),
      flipCount: this.flipCount(),
      date: new Date().toISOString()
    };

    this.records.update(recs => {
      const all = [...recs, newRecord];
      all.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.time !== b.time) return a.time - b.time;
        return a.flipCount - b.flipCount;
      });
      return all.slice(0, 500); // keep up to 500 records overall
    });

    this.hasSavedRecord.set(true);
    this.saveData();
    this.leaderboardTab.set(this.selectedDifficulty().id);
    this.showLeaderboard();
  }

  updateStats() {
    const currentDifficulty = this.selectedDifficulty().id;
    const currentScore = this.score();
    const currentTimeMs = this.elapsedSeconds();
    const currentFlips = this.flipCount();

    this.stats.update(s => {
      const newStats = { ...s };
      newStats.gamesPlayed++;
      newStats.totalTime += currentTimeMs;
      newStats.totalScore += currentScore;
      
      if (!newStats.bestTime) newStats.bestTime = { easy: null, medium: null, hard: null };
      if (!newStats.bestScore) newStats.bestScore = { easy: null, medium: null, hard: null };
      if (!newStats.bestFlips) newStats.bestFlips = { easy: null, medium: null, hard: null };

      if (newStats.bestTime[currentDifficulty] === null || currentTimeMs < newStats.bestTime[currentDifficulty]!) {
        newStats.bestTime[currentDifficulty] = currentTimeMs;
      }
      if (newStats.bestScore[currentDifficulty] === null || currentScore > newStats.bestScore[currentDifficulty]!) {
        newStats.bestScore[currentDifficulty] = currentScore;
      }
      if (newStats.bestFlips[currentDifficulty] === null || currentFlips < newStats.bestFlips[currentDifficulty]!) {
        newStats.bestFlips[currentDifficulty] = currentFlips;
      }

      return newStats;
    });
    this.saveData();
  }

  returnToMenu() {
    this.stopTimer();
    this.gameState.set('menu');
  }

  private playSoundEffect(type: 'flip' | 'match' | 'error' | 'win') {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      const now = ctx.currentTime;
      
      if (type === 'flip') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(500, now + 0.1);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'match') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.1);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.2);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'win') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.1);
        osc.frequency.setValueAtTime(783.99, now + 0.2);
        osc.frequency.setValueAtTime(1046.50, now + 0.3);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.8);
        osc.start(now);
        osc.stop(now + 0.8);
      }
    } catch (e) {
      // Ignore audio context errors
    }
  }

  initGame() {
    const config = this.selectedDifficulty();
    const pairsCount = config.pairs;
    
    // 隨機選擇指定數量的圖案與顏色
    const shuffledDict = [...this.allIcons].sort(() => Math.random() - 0.5);
    const shuffledColors = [...this.iconColors].sort(() => Math.random() - 0.5);
    const selectedIcons = shuffledDict.slice(0, pairsCount).map((icon, i) => ({
      icon,
      colorClass: shuffledColors[i % shuffledColors.length]
    }));
    
    // 複製圖案以產生配對
    const duplicatedIcons = [...selectedIcons, ...selectedIcons];
    const shuffledGameIcons = duplicatedIcons.sort(() => Math.random() - 0.5);
    
    this.cards.set(shuffledGameIcons.map((item, index) => ({
      id: index,
      icon: item.icon,
      colorClass: item.colorClass,
      isFlipped: false,
      isMatched: false,
      isError: false,
      isSuccess: false
    })));
    this.flippedIndices = [];
    this.isProcessing = false;
    
    this.score.set(0);
    this.flipCount.set(0);
    this.elapsedSeconds.set(0);
    this.hasSavedRecord.set(false);
    this.playerNameInput.set('');
    this.startTimer();
  }

  flipCard(index: number) {
    if (this.isProcessing) return;
    
    const currentCards = this.cards();
    if (currentCards[index].isFlipped || currentCards[index].isMatched) return;

    this.playSoundEffect('flip');

    // 翻開卡片
    this.cards.update(cards => {
      const newCards = [...cards];
      newCards[index] = { ...newCards[index], isFlipped: true };
      return newCards;
    });
    
    // 增加總翻牌次數
    this.flipCount.update(c => c + 1);
    this.flippedIndices.push(index);

    if (this.flippedIndices.length === 2) {
      this.isProcessing = true;
      const [idx1, idx2] = this.flippedIndices;
      
      const newCards = this.cards();
      if (newCards[idx1].icon === newCards[idx2].icon) {
        // 配對成功得 10 * multiplier 分
        const points = Math.floor(10 * this.selectedDifficulty().multiplier);
        this.score.update(s => s + points);
        
        this.playSoundEffect('match');
        
        // 即時顯示成功動畫狀態
        this.cards.update(cards => {
          const updated = [...cards];
          updated[idx1] = { ...updated[idx1], isMatched: true, isSuccess: true };
          updated[idx2] = { ...updated[idx2], isMatched: true, isSuccess: true };
          return updated;
        });

        setTimeout(() => {
          this.cards.update(cards => {
            const updated = [...cards];
            updated[idx1] = { ...updated[idx1], isSuccess: false };
            updated[idx2] = { ...updated[idx2], isSuccess: false };
            return updated;
          });
          this.flippedIndices = [];
          this.isProcessing = false;
          
          if (this.isGameComplete()) {
            this.stopTimer();
            this.playSoundEffect('win');
            this.updateStats();
          }
        }, 500); // 配對成功時的動畫持續時間
      } else {
        // 配對失敗扣 1 * multiplier 分
        const penalty = Math.ceil(1 * this.selectedDifficulty().multiplier);
        this.score.update(s => Math.max(0, s - penalty));
        
        this.playSoundEffect('error');
        
        // 即時顯示失敗震動狀態
        this.cards.update(cards => {
          const updated = [...cards];
          updated[idx1] = { ...updated[idx1], isError: true };
          updated[idx2] = { ...updated[idx2], isError: true };
          return updated;
        });
        
        // 配對失敗，翻回背面
        setTimeout(() => {
          this.cards.update(cards => {
            const updated = [...cards];
            updated[idx1] = { ...updated[idx1], isFlipped: false, isError: false };
            updated[idx2] = { ...updated[idx2], isFlipped: false, isError: false };
            return updated;
          });
          this.flippedIndices = [];
          this.isProcessing = false;
        }, 1000);
      }
    }
  }
}
