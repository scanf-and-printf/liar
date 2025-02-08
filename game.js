class Player {
    constructor(name) {
        this.name = name;
        this.isAlive = true;
        this.shotCount = 0; // 记录每个玩家开枪次数
        this.survivalRate = 0; // 新增：生存率统计
        this.consecutiveSurvival = 0; // 新增：连续生存次数
        this.maxConsecutiveSurvival = 0;
        this.shotHistory = []; // 新增：开枪历史记录
        this.remainingShots = [0, 1, 2, 3, 4, 5]; // 保留这个用于记录剩余位置
    }

    updateStats(survived) {
        this.shotCount++;
        if (survived) {
            this.consecutiveSurvival++;
            this.maxConsecutiveSurvival = Math.max(this.maxConsecutiveSurvival, this.consecutiveSurvival);
            this.survivalRate = (((this.shotCount - 1) / this.shotCount) * 100).toFixed(1);
        } else {
            this.consecutiveSurvival = 0;
            this.survivalRate = (((this.shotCount - 1) / this.shotCount) * 100).toFixed(1);
        }
    }

    // 添加记录开枪历史的方法
    addShotRecord(result, round) {
        this.shotHistory.push({
            round: round,
            result: result,
            time: new Date().toLocaleTimeString()
        });
    }

    // 修改获取射击结果的方法
    getShootResult() {
        // 第6枪必定中弹
        if (this.shotCount >= 5) return true;
        
        // 计算剩余机会数
        const remainingShots = 6 - this.shotCount;
        // 计算必须中弹的概率（确保在剩余次数内必定中弹）
        const mustHitProbability = 1 / remainingShots;
        
        return Math.random() < mustHitProbability;
    }
}

class Game {
    constructor() {
        this.init();
        this.setupDOMElements();
        this.setupEventListeners();
        this.setupVolumeKeyControl();
        this.audioCtx = null;
        this.setupSoundEffects();
        this.maxRounds = 10;
        this.loadReloadSound();
        this.loadGunshotSound();
        
        // 初始化时隐藏玩家设置和游戏控制界面
        this.playerSetup.style.display = 'none';
        this.gameControls.style.display = 'none';
    }

    init() {
        this.players = [];
        this.currentPlayerIndex = 0;
        this.totalShots = 0;
        this.isGameOver = false;
        this.bulletPosition = Math.floor(Math.random() * 6); // 子弹位置
        this.roundCount = 1; // 新增：回合计数
        this.gameStartTime = null; // 新增：游戏时长统计
    }

    setupDOMElements() {
        // 界面控制元素
        this.setupControls = document.querySelector('.setup-controls');
        this.playerSetup = document.querySelector('.player-setup');
        this.gameControls = document.querySelector('.game-controls');
        
        // 玩家相关元素
        this.playerList = document.querySelector('.player-list');
        this.activePlayers = document.getElementById('activePlayers');
        this.currentPlayerSpan = document.getElementById('currentPlayer');
        
        // 游戏状态元素
        this.resultDiv = document.getElementById('result');
        
        // 按钮
        this.startSetupBtn = document.getElementById('startSetup');
        this.addPlayerBtn = document.getElementById('addPlayer');
        this.startGameBtn = document.getElementById('startGame');
        this.shootButton = document.getElementById('shootButton');
        this.restartGameBtn = document.getElementById('restartGame');
        
        // 输入框
        this.playerCountInput = document.getElementById('playerCount');
        this.playerNameInput = document.getElementById('playerName');
    }

    setupEventListeners() {
        this.startSetupBtn.onclick = () => this.startPlayerSetup();
        this.addPlayerBtn.onclick = () => this.addPlayer();
        this.startGameBtn.onclick = () => this.startGame();
        this.restartGameBtn.onclick = () => this.restart();
        
        // 添加键盘事件支持
        this.playerNameInput.onkeypress = (e) => {
            if (e.key === 'Enter') this.addPlayer();
        };
        
        // 添加玩家数量输入限制
        this.playerCountInput.onkeypress = (e) => {
            if (e.key === 'Enter') this.startPlayerSetup();
        };
        
        // 添加输入验证
        this.playerCountInput.oninput = (e) => {
            let value = e.target.value;
            // 移除非数字字符
            value = value.replace(/[^0-9]/g, '');
            // 限制数值范围
            if (value === '0') value = '2';
            if (parseInt(value) > 10) value = '10';
            if (value !== '') value = Math.max(2, Math.min(10, parseInt(value))).toString();
            e.target.value = value;
            
            // 更新开始按钮状态
            this.startSetupBtn.disabled = value === '' || parseInt(value) < 2;
        };
    }

    setupSoundEffects() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();
            
            // 创建音效生成函数
            const createSound = (type) => {
                return async () => {
                    // 确保音频上下文处于运行状态
                    if (this.audioCtx.state === 'suspended') {
                        await this.audioCtx.resume();
                    }

                    const oscillator = this.audioCtx.createOscillator();
                    const gainNode = this.audioCtx.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(this.audioCtx.destination);
                    
                    switch(type) {
                        case 'gunshot':
                            // 改进的枪声效果
                            oscillator.type = 'square';
                            oscillator.frequency.setValueAtTime(50, this.audioCtx.currentTime);
                            gainNode.gain.setValueAtTime(0.5, this.audioCtx.currentTime);
                            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.3);
                            oscillator.start(this.audioCtx.currentTime);
                            oscillator.stop(this.audioCtx.currentTime + 0.3);
                            
                            // 添加噪音效果
                            const noiseOsc = this.audioCtx.createOscillator();
                            const noiseGain = this.audioCtx.createGain();
                            noiseOsc.type = 'sawtooth';
                            noiseOsc.frequency.setValueAtTime(100, this.audioCtx.currentTime);
                            noiseGain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
                            noiseGain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
                            noiseOsc.connect(noiseGain);
                            noiseGain.connect(this.audioCtx.destination);
                            noiseOsc.start(this.audioCtx.currentTime);
                            noiseOsc.stop(this.audioCtx.currentTime + 0.1);
                            break;
                            
                        case 'empty':
                            // 改进的空枪效果
                            oscillator.type = 'sine';
                            oscillator.frequency.setValueAtTime(200, this.audioCtx.currentTime);
                            gainNode.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
                            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.15);
                            oscillator.start(this.audioCtx.currentTime);
                            oscillator.stop(this.audioCtx.currentTime + 0.15);
                            
                            // 添加机械声效果
                            const mechOsc = this.audioCtx.createOscillator();
                            const mechGain = this.audioCtx.createGain();
                            mechOsc.type = 'triangle';
                            mechOsc.frequency.setValueAtTime(150, this.audioCtx.currentTime);
                            mechGain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
                            mechGain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.1);
                            mechOsc.connect(mechGain);
                            mechGain.connect(this.audioCtx.destination);
                            mechOsc.start(this.audioCtx.currentTime);
                            mechOsc.stop(this.audioCtx.currentTime + 0.1);
                            break;
                            
                        case 'click':
                            // 改进的点击效果
                            oscillator.type = 'sine';
                            oscillator.frequency.setValueAtTime(800, this.audioCtx.currentTime);
                            gainNode.gain.setValueAtTime(0.03, this.audioCtx.currentTime);
                            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.05);
                            oscillator.start(this.audioCtx.currentTime);
                            oscillator.stop(this.audioCtx.currentTime + 0.05);
                            break;
                    }
                };
            };

            // 创建音效对象
            this.sounds = {
                click: { play: createSound('click') },
                gunshot: { play: createSound('gunshot') },
                empty: { play: createSound('empty') }
            };

        } catch (e) {
            console.warn('音频系统初始化失败，游戏将在无声模式下运行', e);
            this.sounds = {
                click: { play: () => Promise.resolve() },
                gunshot: { play: () => Promise.resolve() },
                empty: { play: () => Promise.resolve() }
            };
        }
    }

    // 添加加载子弹上膛音效的方法
    loadReloadSound() {
        this.reloadSound = new Audio('RELOADING子弹上膛_耳聆网_[声音ID：37359].mp3');
        this.reloadSound.load();
    }

    // 添加加载枪声音效的方法
    loadGunshotSound() {
        this.gunshotSound = new Audio('手枪开枪声_耳聆网_[声音ID：10070].wav');
        this.gunshotSound.load();
    }

    startPlayerSetup() {
        const count = parseInt(this.playerCountInput.value);
        if (!count || count < 2 || count > 10) {
            this.showMessage('请输入2-10之间的玩家人数！', 'error');
            this.playerCountInput.value = '2';
            return;
        }
        this.setupControls.style.display = 'none';
        this.playerSetup.style.display = 'block';
        this.startGameBtn.disabled = true;
        
        this.showMessage(`请添加 ${count} 名玩家`, 'info');
    }

    addPlayer() {
        const name = this.playerNameInput.value.trim();
        if (!name) {
            this.showMessage('请输入玩家名字！', 'error');
            return;
        }
        if (this.players.some(p => p.name === name)) {
            this.showMessage('玩家名字不能重复！', 'error');
            return;
        }
        
        this.players.push(new Player(name));
        this.updatePlayerList();
        this.playerNameInput.value = '';
        
        if (this.players.length >= parseInt(this.playerCountInput.value)) {
            this.addPlayerBtn.disabled = true;
            this.startGameBtn.disabled = false;
        }
    }

    updatePlayerList() {
        const list = this.isGameOver ? this.playerList : this.activePlayers;
        list.innerHTML = this.players
            .map((player, index) => `
                <div class="player-item ${!player.isAlive ? 'dead' : ''} 
                     ${index === this.currentPlayerIndex ? 'current' : ''}"
                     data-index="${index}"
                     data-clickable="true">
                    <div class="player-name">
                        ${player.name}
                        ${!this.isGameOver && index === this.currentPlayerIndex && player.isAlive ? ' (当前选择)' : ''}
                        ${!player.isAlive ? ' (已阵亡)' : ''}
                    </div>
                    <div class="player-stats">
                        <span class="stats-item">开枪: ${player.shotCount}/6</span>
                        <span class="stats-item">生存率: ${player.survivalRate}%</span>
                        ${!this.isGameOver ? 
                            `<span class="stats-item">回合: ${this.roundCount}/${this.maxRounds}</span>` : 
                            ''}
                        ${player.consecutiveSurvival > 2 && player.isAlive ? 
                            `<span class="streak">连续生存: ${player.consecutiveSurvival}</span>` : 
                            ''}
                        ${!this.isGameOver && player.isAlive && player.shotCount >= 6 ? 
                            '<span class="warning">已达开枪上限</span>' : 
                            ''}
                    </div>
                    <div class="shot-history">
                        ${this.renderShotHistory(player)}
                    </div>
                </div>
            `)
            .join('');

        // 修改点击事件监听器
        list.querySelectorAll('[data-clickable="true"]').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                const player = this.players[index];
                
                if (this.isGameOver || !player.isAlive) {
                    // 游戏结束或玩家已死亡时显示详细信息
                    this.showPlayerDetails(player);
                } else {
                    // 游戏进行中且玩家存活时可选择为射击者
                    this.selectShooter(index);
                }
            });
        });
    }

    // 添加渲染开枪历史的方法
    renderShotHistory(player) {
        if (player.shotHistory.length === 0) return '';
        
        return `
            <div class="history-container">
                <div class="history-title">开枪记录:</div>
                <div class="history-list">
                    ${player.shotHistory.slice().reverse().map(record => `
                        <div class="history-item ${record.result}">
                            <span class="round">第${record.round}轮</span>
                            <span class="result">
                                ${record.result === 'survive' ? '存活' : '阵亡'}
                            </span>
                            <span class="time">${record.time}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    async selectShooter(index) {
        const player = this.players[index];
        if (this.isGameOver || !player.isAlive) return;
        
        if (player.shotCount >= 6) {
            this.showMessage(`${player.name} 已达到开枪上限(6次)，请选择其他玩家！`, 'error');
            return;
        }

        // 播放子弹上膛音效
        try {
            await this.reloadSound.play();
        } catch (e) {
            console.warn('播放上膛声失败', e);
        }
        
        this.currentPlayerIndex = index;
        this.updatePlayerList();
        this.updateCurrentPlayer();
        this.shootButton.disabled = false;
        
        const remainingShots = 6 - player.shotCount;
        const probability = (1 / remainingShots * 100).toFixed(1);
        this.showMessage(
            `轮到 ${player.name} 扣动扳机 (第 ${player.shotCount + 1}/6 次)\n` +
            `剩余 ${remainingShots} 次机会，当前中弹概率 ${probability}%\n` +
            `可以使用音量键扣动扳机`,
            'info'
        );
    }

    startGame() {
        this.gameStartTime = Date.now();
        this.playerSetup.style.display = 'none';
        this.gameControls.style.display = 'block';
        
        // 获取射击按钮并添加事件监听
        this.shootButton = document.getElementById('shootButton');
        this.shootButton.addEventListener('click', () => this.shoot());
        
        // 添加提示信息
        this.showMessage('请选择一位玩家开始游戏\n(可以使用音量键扣动扳机)', 'info');
        
        this.updatePlayerList();
    }

    async shoot() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        
        // 检查开枪次数限制
        if (currentPlayer.shotCount >= 6) {
            this.showMessage(`${currentPlayer.name} 已达到开枪上限(6次)，必须选择其他玩家！`, 'error');
            this.shootButton.disabled = true;
            return;
        }

        this.totalShots++;
        this.shootButton.disabled = true;
        
        // 获取射击结果，固定1/6概率
        const isHit = currentPlayer.getShootResult();
        
        // 记录开枪历史并立即更新显示
        currentPlayer.addShotRecord(
            isHit ? 'dead' : 'survive',
            this.roundCount
        );
        currentPlayer.updateStats(!isHit);
        
        // 立即更新玩家列表显示
        this.updatePlayerList();
        
        // 播放音效和显示结果
        if (isHit) {
            try {
                // 使用新的枪声音效替换原来的音效
                await this.gunshotSound.play();
            } catch (e) {
                console.warn('播放枪声失败', e);
            }
            
            // 显示死亡消息
            this.showMessage(`砰！${currentPlayer.name} 中弹身亡！`, 'danger');
            currentPlayer.isAlive = false;
            
            // 更新游戏状态
            this.totalShots = 0;
            this.bulletPosition = Math.floor(Math.random() * 6);
            this.roundCount++;
            
            // 再次更新显示
            this.updatePlayerList();
            
            // 检查游戏是否结束
            const alivePlayers = this.players.filter(p => p.isAlive);
            if (alivePlayers.length === 1) {
                this.gameOver(alivePlayers[0]);
                return;
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            this.showMessage(`第 ${this.roundCount} 回合开始！请选择射击者`, 'info');
        } else {
            try {
                await this.sounds.empty.play();
            } catch (e) {
                console.warn('播放空枪声失败', e);
            }
            
            this.showMessage(`咔嚓，${currentPlayer.name} 活了下来`, 'success');
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // 检查是否还有可以开枪的玩家
        const availablePlayers = this.players.filter(p => 
            p.isAlive && p.shotCount < 6
        );
        
        if (availablePlayers.length === 0) {
            // 如果没有可开枪的玩家，开始新一轮
            this.startNewRound();
            // 立即更新显示
            this.updatePlayerList();
        } else {
            this.showMessage('请选择下一位射击者', 'info');
        }
    }

    nextPlayer() {
        do {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        } while (!this.players[this.currentPlayerIndex].isAlive);
        
        this.updatePlayerList();
        this.updateCurrentPlayer();
    }

    updateCurrentPlayer() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        this.currentPlayerSpan.textContent = `${currentPlayer.name} (开枪次数: ${currentPlayer.shotCount})`;
    }

    showMessage(text, type = 'info') {
        this.resultDiv.textContent = text;
        this.resultDiv.className = `message ${type}`;
    }

    gameOver(winner, reachedMaxRounds = false) {
        const gameDuration = Math.floor((Date.now() - this.gameStartTime) / 1000);
        const minutes = Math.floor(gameDuration / 60);
        const seconds = gameDuration % 60;
        
        this.isGameOver = true;
        this.showMessage(
            `游戏结束！${reachedMaxRounds ? '(达到最大回合数)' : ''}\n` +
            `胜利者：${winner.name}\n` +
            `总回合数：${this.roundCount}/${this.maxRounds}\n` +
            `游戏时长：${minutes}分${seconds}秒\n` +
            `开枪次数：${winner.shotCount}\n` +
            `生存率：${winner.survivalRate}%\n` +
            `最长连续生存：${winner.maxConsecutiveSurvival}次\n` +
            `\n点击任意玩家查看详细统计`,
            'success'
        );
        
        this.shootButton.style.display = 'none';
        
        // 修改重新开始按钮的显示
        this.restartGameBtn.style.display = 'block';
        this.restartGameBtn.textContent = '完全重新开始';
        
        // 添加保留玩家重新开始按钮
        const keepPlayersBtn = document.createElement('button');
        keepPlayersBtn.id = 'keepPlayersBtn';
        keepPlayersBtn.textContent = '保留玩家重新开始';
        keepPlayersBtn.onclick = () => this.restartWithSamePlayers();
        keepPlayersBtn.className = 'restart-button';
        this.gameControls.appendChild(keepPlayersBtn);
        
        // 更新所有玩家的显示
        this.updatePlayerList();
    }

    // 添加保留玩家重新开始的方法
    restartWithSamePlayers() {
        // 重置所有玩家状态
        this.players.forEach(player => {
            player.isAlive = true;
            player.shotCount = 0;
            player.survivalRate = 0;
            player.consecutiveSurvival = 0;
            player.maxConsecutiveSurvival = 0;
            player.remainingShots = [0, 1, 2, 3, 4, 5];
            player.shotHistory = [];
        });
        
        // 重置游戏状态
        this.currentPlayerIndex = 0;
        this.totalShots = 0;
        this.isGameOver = false;
        this.bulletPosition = Math.floor(Math.random() * 6);
        this.roundCount = 1;
        this.gameStartTime = Date.now();
        
        // 重置界面
        this.shootButton.style.display = 'inline-block';
        this.shootButton.disabled = true;
        this.restartGameBtn.style.display = 'none';
        const keepPlayersBtn = document.getElementById('keepPlayersBtn');
        if (keepPlayersBtn) {
            keepPlayersBtn.remove();
        }
        
        // 更新显示
        this.updatePlayerList();
        this.showMessage('游戏已重新开始，请选择一位玩家开始游戏', 'info');
    }

    restart() {
        location.reload();
    }

    // 修改显示玩家详细信息的方法，添加更多统计信息
    showPlayerDetails(player) {
        const deathRecord = player.shotHistory.find(record => record.result === 'dead');
        const deathRound = deathRecord ? deathRecord.round : '未知';
        const survivalShots = player.shotHistory.filter(record => record.result === 'survive').length;
        
        let status = player.isAlive ? 
            (this.isGameOver ? '游戏胜利' : '存活中') : 
            `第${deathRound}轮阵亡`;

        this.showMessage(
            `玩家详情 - ${player.name}\n` +
            `当前状态: ${status}\n` +
            `总开枪次数: ${player.shotCount}\n` +
            `成功存活: ${survivalShots}次\n` +
            `生存率: ${player.survivalRate}%\n` +
            `最长连续生存: ${player.maxConsecutiveSurvival || player.consecutiveSurvival}次\n` +
            `${!player.isAlive ? `阵亡回合: 第${deathRound}轮` : ''}`,
            'info'
        );
    }

    // 添加新一轮的处理方法
    startNewRound() {
        this.roundCount++;
        
        // 检查是否达到最大轮数
        if (this.roundCount > this.maxRounds) {
            const survivors = this.players.filter(p => p.isAlive);
            const winner = survivors.reduce((prev, current) => {
                return (prev.survivalRate > current.survivalRate) ? prev : current;
            });
            
            this.gameOver(winner, true);
            return;
        }

        // 重置所有存活玩家的开枪次数
        this.players.forEach(player => {
            if (player.isAlive) {
                player.shotCount = 0;
            }
        });
        
        this.showMessage(
            `第 ${this.roundCount}/${this.maxRounds} 轮开始！\n` +
            `所有存活玩家的开枪次数已重置，每人有6次机会，必须在6枪内中弹`,
            'info'
        );
    }

    // 添加音量键控制方法
    setupVolumeKeyControl() {
        // 阻止音量键的默认行为
        document.addEventListener('keydown', (e) => {
            if (e.code === 'VolumeUp' || e.code === 'VolumeDown') {
                e.preventDefault();
                // 如果按钮可用，触发射击
                if (!this.shootButton.disabled) {
                    this.shoot();
                }
            }
        }, true);

        // 监听移动设备的音量键事件
        if ('volumechange' in window) {
            let lastVolume = window.audioContext?.volume || 1;
            let volumeCheckTimeout;

            window.addEventListener('volumechange', () => {
                // 清除之前的超时
                clearTimeout(volumeCheckTimeout);

                // 设置新的超时，防止连续触发
                volumeCheckTimeout = setTimeout(() => {
                    const newVolume = window.audioContext?.volume || 1;
                    if (newVolume !== lastVolume) {
                        // 如果按钮可用，触发射击
                        if (!this.shootButton.disabled) {
                            this.shoot();
                        }
                        lastVolume = newVolume;
                    }
                }, 100);
            });
        }
    }
}

// 创建样式元素
const style = document.createElement('style');
style.textContent = `
    * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
    }

    body {
        margin: 0;
        padding: 8px;
        background: #f0f0f0;
        font-family: system-ui, -apple-system, sans-serif;
    }

    .game-container {
        max-width: 500px;
        margin: 0 auto;
        padding: 12px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    h1 {
        font-size: 1.3em;
        margin: 8px 0;
        text-align: center;
    }

    .setup-controls {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin: 8px 0;
    }

    input {
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 0.95em;
    }

    button {
        padding: 8px 12px;
        border: none;
        border-radius: 6px;
        background: #4CAF50;
        color: white;
        font-size: 0.95em;
        cursor: pointer;
    }

    .shoot-button {
        width: 100%;
        max-width: 250px;
        padding: 12px;
        margin: 8px auto;
        background: #d32f2f;
        font-size: 1.1em;
        border-radius: 20px;
    }

    .message {
        padding: 8px;
        margin: 8px 0;
        border-radius: 6px;
        font-size: 0.95em;
        text-align: center;
    }

    .player-item {
        padding: 8px;
        margin: 6px 0;
        background: #4CAF50;
        border-radius: 8px;
        color: white;
        min-height: 100px;
        display: flex;
        flex-direction: column;
        transition: all 0.3s ease;
    }

    .player-name {
        font-size: 1em;
        font-weight: 500;
        margin-bottom: 4px;
        height: 1.5em;
        display: flex;
        align-items: center;
    }

    .player-stats {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin: 4px 0;
        min-height: 28px;
    }

    .stats-item {
        padding: 2px 6px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 10px;
        font-size: 0.85em;
        height: 24px;
        display: flex;
        align-items: center;
    }

    .streak, .warning {
        height: 24px;
        display: flex;
        align-items: center;
    }

    .history-container {
        margin-top: 6px;
        padding: 6px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        flex-grow: 1;
        display: flex;
        flex-direction: column;
    }

    .history-list {
        max-height: 80px;
        overflow-y: auto;
        flex-grow: 1;
    }

    .history-item {
        padding: 4px;
        margin: 2px 0;
        border-radius: 4px;
        font-size: 0.85em;
        display: flex;
        justify-content: space-between;
        align-items: center;
        height: 24px;
        background: rgba(255, 255, 255, 0.1);
    }

    .history-list::-webkit-scrollbar {
        width: 4px;
    }

    .history-list::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 2px;
    }

    .history-list::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 2px;
    }

    .dead, .current {
        min-height: 100px;
    }

    @media (max-width: 480px) {
        body {
            padding: 4px;
        }

        .game-container {
            padding: 8px;
        }

        h1 {
            font-size: 1.2em;
        }

        .shoot-button {
            padding: 10px;
            font-size: 1em;
        }

        .player-item {
            min-height: 90px;
        }

        .stats-item, .streak, .warning, .history-item {
            height: 22px;
        }
    }

    .message.info { background: #e3f2fd; color: #1565c0; }
    .message.success { background: #e8f5e9; color: #2e7d32; }
    .message.error { background: #ffebee; color: #c62828; }
    .message.danger { background: #fff3e0; color: #e65100; }
`;

document.head.appendChild(style);

// 将游戏实例暴露给全局作用域，以便于点击事件调用
window.game = null;
window.onload = () => {
    window.game = new Game();
}; 