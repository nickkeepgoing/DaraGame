import Phaser from 'phaser';
import {
  BALANCE,
  PX_PER_METER,
  QUESTIONS_PER_STAGE,
  STAGE_COUNT,
  wallSpeedAt,
} from '@/config/balance';
import { emitBus, onBus } from '@/game/EventBus';
import { touchInput } from '@/game/input';
import { Rng } from '@/game/systems/Rng';
import { createTextures } from '@/game/systems/textures';
import { sfx, setMusicIntensity, startMusic, stopMusic } from '@/audio/sfx';
import type { EndReason, QuestionKind } from '@/types/game';

export const VIEW_W = 1280;
export const VIEW_H = 720;

const GROUND_Y = BALANCE.level.groundY;

interface Segment {
  dirt: Phaser.GameObjects.Rectangle;
  grass: Phaser.GameObjects.Rectangle;
  left: number;
  right: number;
}

type ArcadeSprite = Phaser.Physics.Arcade.Sprite;

export class GameScene extends Phaser.Scene {
  /* ---------------- โลก ---------------- */
  private rng!: Rng;
  private segments: Segment[] = [];
  private obstacles!: Phaser.Physics.Arcade.Group;
  private meteors!: Phaser.Physics.Arcade.Group;
  private gates!: Phaser.Physics.Arcade.Group;
  private gems!: Phaser.Physics.Arcade.Group;
  private boxes!: Phaser.Physics.Arcade.Group;
  private decors!: Phaser.GameObjects.Group;
  private groundGroup!: Phaser.Physics.Arcade.StaticGroup;


  /* ---------------- ตัวละคร ---------------- */
  private player!: ArcadeSprite;
  private startX = 240;
  private lastGroundedX = 240;

  /* ---------------- กำแพงวันสิ้นโลก ---------------- */
  private wallBody!: Phaser.GameObjects.Rectangle;
  private wallEdge!: Phaser.GameObjects.TileSprite;
  private wallEmber!: Phaser.GameObjects.Particles.ParticleEmitter;
  private wallX = 0;

  /* ---------------- ฉากหลัง ---------------- */
  private sky!: Phaser.GameObjects.Rectangle;
  private skyGlow!: Phaser.GameObjects.Rectangle;
  private clouds!: Phaser.GameObjects.TileSprite;
  private hills!: Phaser.GameObjects.TileSprite;
  private trees!: Phaser.GameObjects.TileSprite;
  private bushes!: Phaser.GameObjects.TileSprite;
  private dangerVignette!: Phaser.GameObjects.Rectangle;

  /* ---------------- สถานะเกม ---------------- */
  private started = false;
  private dead = false;
  private quizActive = false;
  private hearts = BALANCE.player.hearts;
  private distanceM = 0;
  private elapsedMs = 0;
  private chaseMs = 0;
  private invincibleUntilMs = 0;
  private wrongBoostUntilMs = 0;
  private wrongBoostAmount = BALANCE.wall.speedUpOnWrong;

  /* ---------------- ด่าน / ควิซ ---------------- */
  /** ด่านปัจจุบัน 1-3, และ STAGE_COUNT + 1 = ช่วงบอสสุดท้าย */
  private stage = 1;
  private stageProgress = 0;
  private appliedStage = -1;
  /** true เมื่อผ่านคำถามครบทุกด่านแล้ว เหลือแค่บอส */
  private bossPending = false;
  private pendingKind: QuestionKind = 'main';
  private revivesLeft = BALANCE.player.maxRevives;
  private reviving = false;
  private pendingDeathReason: EndReason = 'wall';
  /** จุด checkpoint ล่าสุดที่ผ่านมา — ใช้เป็นที่ฟื้น */
  private lastCheckpointX = 240;

  /* ---------------- การสร้างด่าน ---------------- */
  private genX = 0;
  private nextGateX = 0;
  private nextObstacleX = 0;
  private nextBoxX = 0;
  private nextMeteorAtMs = 0;
  private reserved: [number, number][] = [];

  /* ---------------- อินพุต ---------------- */
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private lastGroundedAtMs = 0;
  private jumpBufferedAtMs = -9999;
  private jumpStartedAtMs = -9999;
  private jumpHeld = false;
  private ducking = false;

  /* ---------------- HUD throttle ---------------- */
  private hudAccMs = 0;
  private lastWarnAtMs = 0;
  private unsubscribers: (() => void)[] = [];

  /** body ของผู้เล่นแบบไม่ต้อง cast ทุกบรรทัด */
  private get pbody(): Phaser.Physics.Arcade.Body {
    return this.player.body as Phaser.Physics.Arcade.Body;
  }

  constructor() {
    super('GameScene');
  }

  init(data: { seed?: number }): void {
    this.rng = new Rng(data.seed ?? (this.game.registry.get('seed') as number) ?? 1);

    // รีเซ็ตทุกตัว — scene ถูกใช้ซ้ำได้ ถ้าลืมรีเซ็ตจะได้คะแนนค้างจากรอบก่อน
    this.segments = [];
    this.started = false;
    this.dead = false;
    this.quizActive = false;
    this.hearts = BALANCE.player.hearts;
    this.distanceM = 0;
    this.elapsedMs = 0;
    this.chaseMs = 0;
    this.invincibleUntilMs = 0;
    this.wrongBoostUntilMs = 0;
    this.wrongBoostAmount = BALANCE.wall.speedUpOnWrong;
    this.stage = 1;
    this.stageProgress = 0;
    this.appliedStage = -1;
    this.bossPending = false;
    this.pendingKind = 'main';
    this.revivesLeft = BALANCE.player.maxRevives;
    this.reviving = false;
    this.pendingDeathReason = 'wall';
    this.lastCheckpointX = this.startX;
    this.genX = 0;
    this.reserved = [];
    this.hudAccMs = 0;
    this.lastGroundedX = this.startX;
  }

  preload(): void {
    createTextures(this);
  }

  create(): void {
    this.buildBackground();
    this.buildWorld();
    this.buildPlayer();
    this.buildWall();
    this.bindInput();
    this.bindBusEvents();

    this.cameras.main.setBounds(0, 0, 1e7, VIEW_H);
    this.cameras.main.setScroll(0, 0);

    this.genX = 0;
    this.nextGateX = this.startX + BALANCE.quiz.firstCheckpointM * PX_PER_METER;
    this.nextObstacleX = this.startX + 900;
    this.nextBoxX = this.startX + 1400;
    this.nextMeteorAtMs = 0;
    this.generateAhead();

    this.applyStage(1);
    emitBus('game:ready');
  }

  /* ================================================================
     สร้างฉาก
     ================================================================ */

  private buildBackground(): void {
    this.sky = this.add
      .rectangle(0, 0, VIEW_W, VIEW_H, 0x3a2350)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-100);

    // แสงอบอุ่นตรงเส้นขอบฟ้า (โทนพาสเทลตาม GDD ข้อ 2.1)
    this.skyGlow = this.add
      .rectangle(0, VIEW_H * 0.42, VIEW_W, VIEW_H * 0.58, 0xffb37b, 0.85)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-99);

    // ดาวบนฟ้า — สร้างเป็น texture ครั้งเดียว ถูกกว่าวาด 80 object
    if (!this.textures.exists('starfield')) {
      const g = this.add.graphics();
      for (let i = 0; i < 90; i++) {
        const x = Math.random() * VIEW_W;
        const y = Math.random() * VIEW_H * 0.6;
        g.fillStyle(0xfff3c4, 0.35 + Math.random() * 0.55);
        g.fillCircle(x, y, Math.random() < 0.15 ? 2.2 : 1.2);
      }
      g.generateTexture('starfield', VIEW_W, VIEW_H);
      g.destroy();
    }
    this.add.image(0, 0, 'starfield').setOrigin(0, 0).setScrollFactor(0).setDepth(-98).setAlpha(0.5);

    this.clouds = this.add
      .tileSprite(0, 70, VIEW_W, 58, 'cloud')
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-97)
      .setAlpha(0.5);

    this.hills = this.add
      .tileSprite(0, VIEW_H - 340, VIEW_W, 200, 'hill')
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-96)
      .setAlpha(0.55);

    this.trees = this.add
      .tileSprite(0, VIEW_H - 310, VIEW_W, 190, 'tree_far')
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-95)
      .setAlpha(0.85);

    // พุ่มไม้ชั้นหน้า วิ่งเร็วกว่าชั้นต้นไม้ → ตารับรู้ความลึกได้ชัดขึ้นมาก
    this.bushes = this.add
      .tileSprite(0, VIEW_H - 205, VIEW_W, 110, 'bush_near')
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(-94)
      .setAlpha(0.9);

    // ขอบจอเรืองแสงตอนกำแพงใกล้ — "หายใจ" ช้าๆ ไม่ใช่กะพริบ
    // (กะพริบเกิน 3 ครั้ง/วินาที กระตุ้นอาการชักได้ — WCAG 2.3.1)
    this.dangerVignette = this.add
      .rectangle(0, 0, VIEW_W, VIEW_H, 0xff4a2b, 0)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(60);
  }

  private buildWorld(): void {
    this.groundGroup = this.physics.add.staticGroup();

    this.obstacles = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      maxSize: BALANCE.perf.poolSize.obstacle,
      allowGravity: false,
      immovable: true,
    });

    this.meteors = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      maxSize: 16,
      allowGravity: false,
    });

    this.gates = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      maxSize: 6,
      allowGravity: false,
      immovable: true,
    });

    this.gems = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      maxSize: 32,
      allowGravity: false,
      immovable: true,
    });

    // กล่องปริศนา — กระโดดชนจากข้างล่างแบบมาริโอ
    // ใช้ collider (ไม่ใช่ overlap) เพื่อให้ยืนบนกล่องได้ด้วย
    this.boxes = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      maxSize: 16,
      allowGravity: false,
      immovable: true,
    });

    this.decors = this.add.group({
      classType: Phaser.GameObjects.Sprite,
      maxSize: 64,
    });
  }

  private buildPlayer(): void {
    this.anims.create({
      key: 'run',
      frames: [{ key: 'dino_run_0' }, { key: 'dino_run_1' }],
      frameRate: 11,
      repeat: -1,
    });

    this.player = this.physics.add.sprite(this.startX, GROUND_Y - 120, 'dino_run_0');
    this.player.setDepth(10);
    this.player.setOrigin(0.5, 1);
    // ซอโรพอดสูง 84 px — hitbox ครอบลำตัว+ขา+โคนคอ (สูง 66 px จากพื้น)
    // ไม่ครอบหัวกับหางเพื่อให้อภัยผู้เล่น แต่ยังสูงพอให้เทอโรซอร์ที่บินระดับหัวชนได้
    this.pbody.setSize(42, 66);
    this.pbody.setOffset(25, 18);
    this.player.setMaxVelocity(BALANCE.player.maxSpeed * 1.4, BALANCE.player.maxFallSpeed);
    this.player.play('run');

    this.physics.add.collider(this.player, this.groundGroup);
    this.physics.add.overlap(this.player, this.obstacles, (_p, o) =>
      this.onObstacleHit(o as ArcadeSprite),
    );
    this.physics.add.overlap(this.player, this.meteors, (_p, m) =>
      this.onMeteorHit(m as ArcadeSprite),
    );
    this.physics.add.overlap(this.player, this.gates, (_p, g) => this.onGateReached(g as ArcadeSprite));
    this.physics.add.overlap(this.player, this.gems, (_p, g) => this.onGemCollect(g as ArcadeSprite));
    this.physics.add.collider(this.player, this.boxes, (_p, b) => this.onBoxTouch(b as ArcadeSprite));


    // ฝุ่นใต้เท้าตอนวิ่ง
    this.add
      .particles(0, 0, 'dust', {
        follow: this.player,
        followOffset: { x: -14, y: -4 },
        speedX: { min: -90, max: -30 },
        speedY: { min: -30, max: 10 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 0.5, end: 0 },
        lifespan: 420,
        frequency: 90,
        quantity: 1,
      })
      .setDepth(9);
  }

  private buildWall(): void {
    this.wallX = this.startX - BALANCE.wall.startGapPx;

    this.wallBody = this.add
      .rectangle(this.wallX, VIEW_H / 2, 2400, 2000, 0xe14a2b, 0.96)
      .setOrigin(1, 0.5)
      .setDepth(20);

    this.wallEdge = this.add
      .tileSprite(this.wallX, VIEW_H / 2, 24, 2000, 'lava_edge')
      .setOrigin(1, 0.5)
      .setDepth(21);

    this.wallEmber = this.add
      .particles(0, 0, 'ember', {
        x: { min: -60, max: 10 },
        y: { min: -400, max: 400 },
        speedX: { min: -40, max: 120 },
        speedY: { min: -220, max: -60 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 0.9, end: 0 },
        lifespan: { min: 700, max: 1500 },
        frequency: 45,
        quantity: 2,
      })
      .setDepth(22);
  }

  private bindInput(): void {
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.keyA = kb.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = kb.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyW = kb.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyS = kb.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // ไม่ให้ Space/ลูกศรเลื่อนหน้าเว็บระหว่างเล่น
    kb.addCapture([
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
    ]);
  }

  private bindBusEvents(): void {
    // ⚠️ ทุก .on() ต้องมี .off() — เก็บ unsubscribe ไว้เรียกตอน shutdown
    this.unsubscribers.push(
      onBus('game:start', () => {
        this.started = true;
        startMusic();
      }),
      onBus('quiz:answered', ({ isCorrect, kind, points }) =>
        this.onQuizAnswered(isCorrect, kind, points),
      ),
      onBus('game:quit', () => this.endGame('quit')),
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribers.forEach((off) => off());
      this.unsubscribers = [];
      stopMusic();
    });
  }

  /* ================================================================
     สร้างด่านแบบไม่รู้จบ (seeded — ทุกคนที่ seed เดียวกันเจอด่านเดียวกัน)
     ================================================================ */

  private generateAhead(): void {
    const target = this.player ? this.player.x + 2400 : this.startX + 2400;

    while (this.genX < target) {
      const width = this.rng.range(460, 980);
      this.placeGround(this.genX, width);
      this.populateSegment(this.genX, width);
      this.genX += width;

      const meters = (this.genX - this.startX) / PX_PER_METER;
      if (meters > 25 && this.rng.chance(this.stageConfig().pitChance)) {
        this.genX += this.rng.range(BALANCE.level.pitWidthPx.min, BALANCE.level.pitWidthPx.max);
      }
    }
  }

  private placeGround(x: number, width: number): void {
    // ⚠️ ห้าม recycle ท่อนพื้นที่ครอบ checkpoint ล่าสุด (lastCheckpointX) ทิ้ง
    // แม้จะเลยกล้องไปไกลแล้วก็ตาม — doRevive() เทเลพอร์ตผู้เล่นย้อนกลับไปยืนตรงนั้น
    // ถ้าท่อนพื้นตรงนั้นถูกยกไปใช้สร้างพื้นใหม่ข้างหน้าไปแล้ว (recycle ปกติจะทำ
    // ทันทีที่เลยกล้องไป 400px) ผู้เล่นจะฟื้นขึ้นมาลอยอยู่กลางอากาศแล้วตกทะลุพื้น
    const cutoff = Math.min(this.cameras.main.scrollX - 400, this.lastCheckpointX - 200);
    let seg = this.segments.find((s) => s.right < cutoff);

    if (!seg) {
      const dirt = this.add.rectangle(0, 0, 10, 200, 0xa9714b).setDepth(0);
      const grass = this.add.rectangle(0, 0, 10, 16, 0x9bd17b).setDepth(1);
      this.groundGroup.add(dirt);
      seg = { dirt, grass, left: 0, right: 0 };
      this.segments.push(seg);
    }

    seg.left = x;
    seg.right = x + width;

    seg.dirt.setSize(width, 220).setPosition(x + width / 2, GROUND_Y + 110);
    seg.grass.setSize(width, 16).setPosition(x + width / 2, GROUND_Y + 8);

    const body = seg.dirt.body as Phaser.Physics.Arcade.StaticBody;
    body.setSize(width, 220);
    body.updateFromGameObject();
  }

  private populateSegment(x: number, width: number): void {
    const left = x + 160;
    const right = x + width - 160;
    if (right <= left) return;

    // --- checkpoint คำถาม (สำคัญกว่าตัวขวาง จองที่ก่อน) ---
    if (this.nextGateX < right) {
      const gx = Math.max(this.nextGateX, left);
      if (gx < right) {
        this.spawnGate(gx);
        this.reserved.push([gx - 200, gx + 200]);
        if (this.reserved.length > 8) this.reserved.shift();

        const jitter = this.rng.range(
          -BALANCE.quiz.checkpointJitterM,
          BALANCE.quiz.checkpointJitterM,
        );
        this.nextGateX = gx + (BALANCE.quiz.checkpointEveryM + jitter) * PX_PER_METER;
      }
    }

    // --- ตัวขวางบนพื้น ---
    const spacing = this.stageConfig().spawnEveryM * PX_PER_METER;
    const minGap = BALANCE.level.minGapBetweenObstaclesM * PX_PER_METER;

    const L = BALANCE.level;
    const stageKey = `stage${Math.min(this.stage, STAGE_COUNT)}` as 'stage1' | 'stage2' | 'stage3';

    while (this.nextObstacleX < right) {
      const ox = Math.max(this.nextObstacleX, left);
      if (ox >= right) break;

      // ตัวขวางมาเป็นกลุ่มติดกัน — ต้องกระโดดข้ามทีเดียวทั้งกลุ่ม ไม่ใช่ทีละอัน
      const cluster = this.rng.chance(L.clusterChance[stageKey]) ? this.rng.int(2, L.clusterMax) : 1;
      let placed = 0;
      let cx = ox;
      for (let i = 0; i < cluster; i++) {
        if (cx >= right) break;
        if (!this.isReserved(cx)) {
          this.spawnObstacle(cx, i === 0);
          placed++;
        }
        cx += this.rng.range(L.clusterGapPx.min, L.clusterGapPx.max);
      }

      const groupWidth = Math.max(placed - 1, 0) * L.clusterGapPx.max;
      this.nextObstacleX =
        ox + groupWidth + Math.max(spacing * this.rng.range(0.75, 1.35), minGap);
    }

    // --- กล่องปริศนาลอยเหนือพื้น ---
    // วางเป็นแถว 1-3 กล่องติดกันแบบมาริโอ กระโดดชนทีเดียวได้หลายกล่อง
    while (this.nextBoxX < right) {
      const bx = Math.max(this.nextBoxX, left);
      if (bx >= right) break;

      const count = this.rng.chance(0.35) ? this.rng.int(2, 3) : 1;
      for (let i = 0; i < count; i++) {
        const x = bx + i * 52;
        if (x < right) this.spawnBox(x);
      }

      this.nextBoxX =
        bx + count * 52 + BALANCE.level.boxEveryM * PX_PER_METER * this.rng.range(0.7, 1.4);
    }

    // --- ดาวสะสมคะแนน (Star Gems) ---
    if (this.rng.chance(0.65)) {
      const gemX = left + this.rng.range(60, width - 120);
      if (!this.isReserved(gemX)) {
        const gemY = this.rng.chance(0.5) ? GROUND_Y - 24 : GROUND_Y - 75;
        this.spawnGem(gemX, gemY);
      }
    }

    // --- ของตกแต่งบนพื้นฉาก (Decor Props) ---
    for (let dx = 80; dx < width - 60; dx += this.rng.range(140, 220)) {
      const decX = x + dx;
      if (!this.isReserved(decX)) {
        this.spawnDecor(decX);
      }
    }
  }

  private isReserved(x: number): boolean {
    return this.reserved.some(([a, b]) => x >= a && x <= b);
  }

  /**
   * @param allowTall อนุญาตให้เป็นหินแหลมสูงได้ไหม
   *   ให้เฉพาะตัวแรกของกลุ่ม — ถ้าทั้งกลุ่มเป็นหินแหลมจะข้ามไม่พ้นเลย
   */
  private spawnObstacle(x: number, allowTall = true): void {
    // หินแหลมโผล่ตั้งแต่ด่าน 2 เป็นต้นไป (ด่าน 1 ให้ผู้เล่นชินกับการกระโดดก่อน)
    const tallOK = allowTall && this.stage >= 2;
    const key = this.rng.weighted({
      bomb: tallOK ? 0.36 : 0.5,
      spike_low: tallOK ? 0.22 : 0.28,
      mine: tallOK ? 0.18 : 0.22,
      spike_rock: tallOK ? 0.24 : 0,
    });
    const sprite = this.obstacles.get(x, GROUND_Y, key) as ArcadeSprite | null;
    if (!sprite) return;

    sprite.setTexture(key);
    sprite.enableBody(true, x, GROUND_Y, true, true);
    sprite.setOrigin(0.5, 1).setDepth(5);

    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);

    const w = sprite.width * 0.62;
    const h = sprite.height * 0.72;
    body.setSize(w, h);
    body.setOffset((sprite.width - w) / 2, sprite.height - h);

    // กระพริบเบาๆ ตลอดเวลา — สัญญาณอันตรายที่มองเห็นได้ไกลกว่าสีขอบเฉยๆ
    // โดยเฉพาะตอนพื้นหลังโทนมืด
    this.tweens.killTweensOf(sprite);
    sprite.setAlpha(1);
    this.tweens.add({
      targets: sprite,
      alpha: 0.55,
      duration: 280,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * กล่องปริศนาลอยอยู่ในระดับที่กระโดดชนได้พอดี
   *
   * ผู้เล่นกระโดดสูงสุด 156 px จากพื้น (ดู balance.player) กล่องจึงต้องอยู่ต่ำกว่านั้น
   * ให้หัวชนก้นกล่องได้ระหว่างที่กำลังลอยขึ้น ไม่ใช่ต้องกระโดดสุดแรงถึงจะแตะถึง
   */
  private spawnBox(x: number): void {
    const y = GROUND_Y - BALANCE.level.boxHeightPx;
    const sprite = this.boxes.get(x, y, 'box') as ArcadeSprite | null;
    if (!sprite) return;

    sprite.setTexture('box');
    sprite.enableBody(true, x, y, true, true);
    sprite.setOrigin(0.5, 0.5).setDepth(6);
    sprite.setData('used', false);
    sprite.setData('baseY', y);

    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setSize(sprite.width, sprite.height);
    body.updateFromGameObject?.();

    this.tweens.killTweensOf(sprite);
    sprite.setAlpha(1);
  }

  /**
   * ชนกล่อง — นับเฉพาะตอน "ชนจากข้างล่าง" เหมือนมาริโอ
   * ถ้าเหยียบอยู่บนกล่องหรือชนด้านข้าง จะไม่เปิดกล่อง
   */
  private onBoxTouch(box: ArcadeSprite): void {
    if (!box.active || box.getData('used') === true) return;

    const body = this.pbody;
    const hitFromBelow = body.blocked.up || body.touching.up;
    if (!hitFromBelow) return;

    box.setData('used', true);
    box.setTexture('box_used');
    sfx.checkpoint();

    // กล่องเด้งขึ้นแล้วตกกลับ
    const baseY = (box.getData('baseY') as number) ?? box.y;
    this.tweens.killTweensOf(box);
    this.tweens.add({
      targets: box,
      y: baseY - 14,
      duration: 110,
      yoyo: true,
      ease: 'Quad.easeOut',
      onUpdate: () => (box.body as Phaser.Physics.Arcade.Body).updateFromGameObject?.(),
      onComplete: () => {
        box.y = baseY;
        (box.body as Phaser.Physics.Arcade.Body).updateFromGameObject?.();
      },
    });

    this.popSparkles(box.x, baseY - 26);

    // ของในกล่อง: หัวใจถ้ายังไม่เต็ม ไม่งั้นเป็นโบนัสระยะทาง
    //
    // ⚠️ เคยให้ "ดันกำแพงถอย" ตอนหัวใจเต็ม แต่ใช้ไม่ได้จริง:
    //    ถ้าผู้เล่นนำอยู่ที่เพดาน maxGapPx อยู่แล้ว การผลักกำแพงจะโดน clamp กลับทันที
    //    ผู้เล่นเลยไม่เห็นอะไรเกิดขึ้นเลย — รางวัลที่มองไม่เห็นเท่ากับไม่มีรางวัล
    if (this.hearts < BALANCE.player.hearts) {
      this.hearts += 1;
      this.floatTextAt(box.x, baseY - 40, '+1 ❤️', 0xff8fa8);
    } else {
      this.distanceM += BALANCE.level.boxBonusMeters;
      this.floatTextAt(
        box.x,
        baseY - 40,
        `+${BALANCE.level.boxBonusMeters}m 🌟`,
        0xffd700,
      );
    }
  }

  private popSparkles(x: number, y: number): void {
    const emitter = this.add.particles(x, y, 'sparkle', {
      speed: { min: 60, max: 200 },
      angle: { min: 210, max: 330 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 600,
      quantity: 10,
      emitting: false,
    });
    emitter.setDepth(14);
    emitter.explode(12);
    this.time.delayedCall(800, () => emitter.destroy());
  }

  private spawnGem(x: number, y: number): void {
    const sprite = this.gems.get(x, y, 'star_gem') as ArcadeSprite | null;
    if (!sprite) return;

    sprite.setTexture('star_gem');
    sprite.enableBody(true, x, y, true, true);
    sprite.setOrigin(0.5, 0.5).setDepth(6);
    (sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    sprite.setData('collected', false);

    this.tweens.killTweensOf(sprite);
    this.tweens.add({
      targets: sprite,
      y: y - 6,
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private spawnDecor(x: number): void {
    const stageKeys =
      this.stage === 1
        ? ['flower', 'shroom']
        : this.stage === 2
        ? ['fossil', 'shroom']
        : ['crystal', 'fossil'];
    const key = this.rng.pick(stageKeys);
    const sprite = this.decors.get(x, GROUND_Y, key) as Phaser.GameObjects.Sprite | null;
    if (!sprite) return;

    sprite.setTexture(key);
    sprite.setActive(true).setVisible(true);
    sprite.setPosition(x, GROUND_Y);
    sprite.setOrigin(0.5, 1).setDepth(4);
  }

  private onGemCollect(gem: ArcadeSprite): void {
    if (!gem.active || gem.getData('collected')) return;
    gem.setData('collected', true);
    gem.disableBody(true, true);
    sfx.correct();
    this.distanceM += 15;
    this.floatText('+15m 🌟', 0xffd700);


    const emitter = this.add.particles(gem.x, gem.y, 'sparkle', {
      speed: { min: 40, max: 120 },
      scale: { start: 0.8, end: 0 },
      lifespan: 350,
      quantity: 6,
    });
    this.time.delayedCall(400, () => emitter.destroy());
  }

  private spawnGate(x: number): void {
    const sprite = this.gates.get(x, GROUND_Y - 4, 'gate') as ArcadeSprite | null;
    if (!sprite) return;

    sprite.setTexture('gate');
    sprite.enableBody(true, x, GROUND_Y - 4, true, true);
    sprite.setOrigin(0.5, 1).setDepth(5).setAlpha(0.95);
    const gateBody = sprite.body as Phaser.Physics.Arcade.Body;
    gateBody.setAllowGravity(false);
    // ⚠️ ตัวชน (hitbox) ของประตูสูงแค่ 132px เท่าสไปรท์ แต่กระโดดขึ้นได้ถึง 241px
    //    ถ้าปล่อยตามขนาดสไปรท์ ผู้เล่นกระโดดข้ามประตูได้โดยไม่โดน overlap เลย
    //    ทำให้ข้ามคำถามไปได้ทั้งที่ยังไม่ตอบ — ขยาย hitbox สูงเกินกระโดดสุดแรงไปมาก
    //    (สไปรท์ที่มองเห็นยังขนาดเดิม แค่โซนตรวจชนสูงขึ้น)
    gateBody.setSize(sprite.width, 2000).setOffset(0, sprite.height - 2000);
    sprite.setData('used', false);

    this.tweens.killTweensOf(sprite);
    this.tweens.add({
      targets: sprite,
      alpha: { from: 0.65, to: 1 },
      duration: 900,
      yoyo: true,
      repeat: -1,
    });
  }

  /**
   * เทอโรซอร์บินสวนมาระดับหัว
   *
   * บังคับให้ผู้เล่นได้ใช้ปุ่มหมอบ ซึ่งเดิมแทบไม่ได้ใช้เลย
   * เพราะตัวขวางทุกอันก่อนหน้านี้แก้ด้วยการกระโดดได้หมด
   *
   * ตัวเลขความสูงคิดจาก hitbox จริง (ดู BALANCE.level.pteroHeightPx):
   *   ยืน  สูง 66 px จากพื้น → ทับกับตัวเทอโรซอร์ (43-65) = โดน
   *   หมอบ สูง 26 px จากพื้น → ลอดใต้ไปได้
   *
   * หมายเหตุ: กระโดดข้ามก็รอดได้เหมือนกันถ้าจังหวะดี แต่เสี่ยงกว่ามาก
   * เพราะลงมาแล้วคุมไม่ได้ว่าจะเจอหินอะไรรออยู่
   */
  private spawnPtero(): void {
    const L = BALANCE.level;
    const x = this.player.x + this.rng.range(900, 1500);
    const y = GROUND_Y - L.pteroHeightPx;
    const sprite = this.obstacles.get(x, y, 'ptero') as ArcadeSprite | null;
    if (!sprite) return;

    sprite.setTexture('ptero');
    sprite.enableBody(true, x, y, true, true);
    sprite.setOrigin(0.5, 0.5).setDepth(7);

    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    // บินสวนทางมา = เข้าหาผู้เล่นเร็วกว่าตัวขวางที่อยู่นิ่ง ต้องตัดสินใจไว
    body.setVelocityX(-this.rng.range(L.pteroSpeedPx.min, L.pteroSpeedPx.max));

    // hitbox เอาแค่ลำตัว ไม่รวมปลายปีก — ไม่งั้นโดนทั้งที่ดูเหมือนหลบพ้น
    body.setSize(34, 22);
    body.setOffset((sprite.width - 34) / 2, (sprite.height - 22) / 2);

    // ขยับปีกขึ้นลงให้ดูมีชีวิต
    this.tweens.killTweensOf(sprite);
    this.tweens.add({
      targets: sprite,
      y: y - 8,
      duration: 420,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private spawnMeteor(): void {
    const x = this.player.x + this.rng.range(620, 1250);
    const y = this.cameras.main.scrollY - 80;
    const sprite = this.meteors.get(x, y, 'meteor') as ArcadeSprite | null;
    if (!sprite) return;

    sprite.setTexture('meteor');
    sprite.enableBody(true, x, y, true, true);
    sprite.setDepth(12);

    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocity(this.rng.range(-90, -20), this.rng.range(380, 470));
    body.setCircle(13, 6, 6);

    // กระพริบเบาๆ ตลอดเวลา — สัญญาณอันตรายที่มองเห็นได้ไกลกว่าสีขอบเฉยๆ
    this.tweens.killTweensOf(sprite);
    sprite.setAlpha(1);
    this.tweens.add({
      targets: sprite,
      alpha: 0.55,
      duration: 280,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }


  /* ================================================================
     ลูปหลัก
     ================================================================ */

  update(time: number, rawDelta: number): void {
    // สลับแท็บไปแล้วกลับมา delta จะพุ่งเป็นหลักพัน ตัวละครจะทะลุพื้นตกโลก
    const delta = Math.min(rawDelta, BALANCE.perf.maxDeltaMs);
    const dt = delta / 1000;

    if (this.dead) return;

    if (this.started && !this.quizActive) {
      this.elapsedMs += delta;
      this.updatePlayer(time, dt);
    } else if (this.quizActive) {
      this.elapsedMs += delta;
      this.player.setVelocityX(0);
    }

    this.updateWall(dt);
    this.updateCamera();
    this.updateParallax();
    this.updateMeteors(delta);
    this.recycle();
    this.generateAhead();
    if (this.stage !== this.appliedStage) this.applyStage(this.stage);
    this.checkDeath();
    this.emitHud(delta);
  }

  private updatePlayer(time: number, dt: number): void {
    const body = this.pbody;
    const p = BALANCE.player;
    const onGround = body.blocked.down || body.touching.down;

    if (onGround) {
      this.lastGroundedAtMs = time;
      this.lastGroundedX = this.player.x;
    }

    const left = this.cursors.left.isDown || this.keyA.isDown || touchInput.left;
    const right = this.cursors.right.isDown || this.keyD.isDown || touchInput.right;
    const jumpKey =
      this.cursors.up.isDown || this.keyW.isDown || this.keySpace.isDown || touchInput.jump;
    const duckKey = this.cursors.down.isDown || this.keyS.isDown || touchInput.duck;

    /* ---- แนวนอน: วิ่งอัตโนมัติ กดขวาเพื่อเร่ง กดซ้ายเพื่อถอย ---- */
    let targetVx = p.runSpeed;
    if (right) targetVx = p.maxSpeed;
    else if (left) targetVx = -p.backStepSpeed;
    if (this.ducking) targetVx *= 0.75;

    const vx = body.velocity.x;
    const step = p.accel * dt;
    body.setVelocityX(
      vx < targetVx ? Math.min(vx + step, targetVx) : Math.max(vx - step, targetVx),
    );

    /* ---- หมอบ ---- */
    const wantDuck = duckKey && onGround;
    if (wantDuck !== this.ducking) {
      this.ducking = wantDuck;
      if (wantDuck) {
        this.player.stop();
        this.player.setTexture('dino_duck');
        // หมอบแล้วสูงแค่ 26 px จากพื้น — ลอดใต้เทอโรซอร์ได้พอดี
        body.setSize(50, 26);
        body.setOffset(26, 26);
      } else {
        this.player.play('run', true);
        body.setSize(42, 66);
        body.setOffset(25, 18);
      }
    }

    /* ---- กระโดด: coyote time + jump buffer ----
       สองอย่างนี้รวมกันไม่ถึง 20 บรรทัด แต่คือความต่างระหว่าง
       "เกมนี้บังคับห่วย" กับ "เกมนี้ลื่นดี" — ห้ามตัดทิ้ง */
    if (jumpKey && !this.jumpHeld) this.jumpBufferedAtMs = time;
    this.jumpHeld = jumpKey;

    const withinCoyote = time - this.lastGroundedAtMs <= p.coyoteMs;
    const withinBuffer = time - this.jumpBufferedAtMs <= p.jumpBufferMs;

    if (withinBuffer && (onGround || withinCoyote) && !this.ducking) {
      body.setVelocityY(p.jumpVelocity);
      this.jumpBufferedAtMs = -9999;
      this.lastGroundedAtMs = -9999;
      this.jumpStartedAtMs = time;
      sfx.jump();
    }

    /* ---- ฟิสิกส์กระโดด: แรงโน้มถ่วงไม่เท่ากันแต่ละช่วง ----
       ของเดิมใช้วิธี "ปล่อยนิ้วแล้วตัดความเร็วทิ้งครึ่งหนึ่ง" ซึ่งบังคับให้ต้อง
       กดค้างตลอดถึงจะกระโดดได้ไกล แตะสั้นๆ จะกระโดดกระตุกเตี้ยมาก
       ของใหม่: แตะ = ได้เต็มใบพื้นฐาน / กดค้าง = มีแรงยกเสริมให้สูงขึ้นอีก */
    const jumpAgeMs = time - this.jumpStartedAtMs;
    const vy = body.velocity.y;

    // กดค้างในช่วงแรกหลังออกตัว = มีแรงยกเสริม (ไม่ใช่แค่ "ไม่โดนตัด")
    const boosting = jumpKey && vy < 0 && jumpAgeMs <= p.jumpHoldMs;

    // เลือกตัวคูณแรงโน้มถ่วงตามช่วงของการกระโดด
    let gravityScale: number;
    if (boosting) {
      gravityScale = p.jumpHoldGravityScale;
    } else if (vy < 0) {
      gravityScale = Math.abs(vy) < p.apexThresholdVy ? p.apexGravityScale : 1;
    } else {
      // ขาลง — กดปุ่มลงค้างไว้ = ทิ้งตัวเร็ว (ใช้ลงจากกล่องหรือหลบอุกกาบาต)
      gravityScale =
        Math.abs(vy) < p.apexThresholdVy
          ? p.apexGravityScale
          : duckKey
            ? p.fallGravityScale * p.fastFallScale
            : p.fallGravityScale;
    }

    // Arcade รวม gravity ของ world กับของ body เข้าด้วยกัน
    // อยากได้ผลลัพธ์ = world × scale จึงต้องตั้ง body = world × (scale - 1)
    body.setGravityY(p.gravity * (gravityScale - 1));

    /* ---- ท่าทาง ---- */
    if (!this.ducking) {
      if (!onGround) {
        this.player.stop();
        this.player.setTexture('dino_jump');
      } else if (this.player.anims.currentAnim?.key !== 'run' || !this.player.anims.isPlaying) {
        this.player.play('run', true);
      }
    }

    /* ---- ระยะทาง: นับเฉพาะขาไปข้างหน้า ถอยหลังไม่หักคะแนน ---- */
    this.distanceM = Math.max(this.distanceM, (this.player.x - this.startX) / PX_PER_METER);

    /* ---- ตกหลุม ---- */
    if (this.player.y > GROUND_Y + 260) this.onPitFall();
  }

  private updateWall(dt: number): void {
    if (!this.started) {
      this.syncWallVisuals();
      return;
    }

    // ช่วงผ่อนผัน: กำแพงยังไม่ "ไล่" แต่ลอยตามหลังมาห่างๆ ให้เห็นอยู่มุมจอ
    // ถ้าปล่อยให้มันอยู่กับที่ ผู้เล่นจะวิ่งหนีไปไกลจนมองไม่เห็นภัยคุกคามเลยใน 10 วิแรก
    // แล้วพอถึงเวลาไล่จริง กำแพงจะ "วาร์ป" เข้ามาเพราะโดน maxGapPx ดึงกลับ
    if (this.elapsedMs < BALANCE.wall.startDelayMs) {
      // ⚠️ ต้องใช้ Math.max ไม่ใช่กำหนดค่าตรงๆ
      //    ถ้ากำหนดตรงๆ กำแพงจะถูก "ล็อกติด" กับตัวผู้เล่น พอกดปุ่มถอย (◀)
      //    กำแพงก็ถอยตามไปด้วย ซึ่งผิดธรรมชาติของเกม — ลาวาไม่มีทางไหลถอยหลัง
      //    กำแพงต้องเดินหน้าอย่างเดียว (ratchet) ตามหลังเมื่อผู้เล่นวิ่งไปข้างหน้าเท่านั้น
      this.wallX = Math.max(this.wallX, this.player.x - BALANCE.wall.startGapPx);
      this.syncWallVisuals();
      return;
    }

    this.chaseMs += dt * 1000;

    let speed = wallSpeedAt(this.chaseMs / 1000);
    if (this.quizActive) speed *= BALANCE.quiz.wallSlowFactor;
    if (this.time.now < this.wrongBoostUntilMs) speed *= 1 + this.wrongBoostAmount;

    this.wallX += speed * dt;

    // ไม่ให้หลุดหายไปไกลจนไม่เหลือความกดดัน
    this.wallX = Math.max(this.wallX, this.player.x - BALANCE.wall.maxGapPx);

    // ระหว่างตอบคำถาม กำแพงเข้าใกล้เกินเส้นนี้ไม่ได้ = ตายคาป๊อปอัปไม่ได้
    if (this.quizActive) {
      this.wallX = Math.min(this.wallX, this.player.x - BALANCE.wall.quizSafeGapPx);
    }

    this.syncWallVisuals();
  }

  private syncWallVisuals(): void {
    this.wallBody.setPosition(this.wallX, this.cameras.main.scrollY + VIEW_H / 2);
    this.wallEdge.setPosition(this.wallX, this.cameras.main.scrollY + VIEW_H / 2);
    this.wallEdge.tilePositionY -= 2;
    this.wallEmber.setPosition(this.wallX, this.cameras.main.scrollY + VIEW_H / 2);

    const gap = this.player.x - this.wallX;
    const danger = Phaser.Math.Clamp(1 - gap / BALANCE.wall.warnGapPx, 0, 1);

    // ค่อยๆ เข้ม ไม่กะพริบ
    this.dangerVignette.setFillStyle(0xff4a2b, danger * 0.28);
    setMusicIntensity(Phaser.Math.Clamp(1 - gap / (BALANCE.wall.maxGapPx * 0.75), 0, 1));

    if (danger > 0.55 && this.time.now > (this.lastWarnAtMs ?? 0) + 1400) {
      this.lastWarnAtMs = this.time.now;
      sfx.warn();
    }
  }

  private updateCamera(): void {
    // ตำแหน่งกล้องคำนวณตรงๆ ไม่ใช้ startFollow เพื่อให้ผู้เล่นอยู่ที่เดิมเป๊ะทุกเฟรม
    // (มาตรวัดระยะห่างกำแพงบน HUD จะได้ไม่กระตุก)
    this.cameras.main.scrollX = Math.max(0, this.player.x - VIEW_W * 0.3);
  }

  private updateParallax(): void {
    const sx = this.cameras.main.scrollX;
    this.clouds.tilePositionX = sx * 0.06;
    this.hills.tilePositionX = sx * 0.16;
    this.trees.tilePositionX = sx * 0.3;
    this.bushes.tilePositionX = sx * 0.52;
  }

  private updateMeteors(delta: number): void {
    if (this.distanceM < BALANCE.level.meteorStartM || this.quizActive || !this.started) return;

    this.nextMeteorAtMs -= delta;
    if (this.nextMeteorAtMs <= 0) {
      const L = BALANCE.level;
      const stageKey = `stage${Math.min(this.stage, STAGE_COUNT)}` as 'stage1' | 'stage2' | 'stage3';
      if (this.distanceM >= L.pteroStartM && this.rng.chance(L.pteroChance[stageKey])) {
        this.spawnPtero();
      } else {
        this.spawnMeteor();
      }
      const { min, max } = BALANCE.level.meteorEveryMs;
      // ยิ่งไกล ยิ่งถี่
      const rush = Phaser.Math.Clamp(this.distanceM / 400, 0, 0.45);
      this.nextMeteorAtMs = this.rng.range(min, max) * (1 - rush);
    }

    this.meteors.children.each((child) => {
      const m = child as ArcadeSprite;
      if (!m.active) return null;
      if (m.y > GROUND_Y + 10) {
        this.explode(m.x, GROUND_Y - 10);
        m.disableBody(true, true);
      }
      return null;
    });
  }

  private recycle(): void {
    const cutoff = this.cameras.main.scrollX - 300;
    for (const group of [this.obstacles, this.meteors, this.gates, this.boxes]) {
      group.children.each((child) => {
        const s = child as ArcadeSprite;
        if (s.active && s.x < cutoff) s.disableBody(true, true);
        return null;
      });
    }
  }

  /** ค่าฉาก/ความยากของด่านปัจจุบัน (ด่านบอสใช้ค่าเดียวกับด่าน 3) */
  private stageConfig(stage = this.stage) {
    const list = BALANCE.level.stages;
    return list[Math.min(Math.max(stage, 1), list.length) - 1];
  }

  private applyStage(stage: number): void {
    this.appliedStage = stage;
    const biome = this.stageConfig(stage);

    // สีฉากตามธีมด่าน
    const hillTints = [0x4a6b57, 0x662a34, 0x402b5e];
    const treeTints = [0x2b4e3a, 0x4a1c25, 0x27183e];
    const idx = Math.min(Math.max(stage - 1, 0), 2);

    if (this.hills) this.hills.setTint(hillTints[idx]);
    if (this.trees) this.trees.setTint(treeTints[idx]);

    // เปลี่ยนสีท้องฟ้าแบบนุ่มนวล
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 1400,
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        const top = Phaser.Display.Color.IntegerToColor(this.sky.fillColor);
        const target = Phaser.Display.Color.IntegerToColor(biome.skyTop);
        const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(top, target, 100, t * 100);
        this.sky.setFillStyle(Phaser.Display.Color.GetColor(mixed.r, mixed.g, mixed.b));
      },
    });
    this.skyGlow.setFillStyle(biome.skyBottom, 0.85);
  }


  /* ================================================================
     เหตุการณ์
     ================================================================ */

  private onObstacleHit(obstacle: ArcadeSprite): void {
    if (!obstacle.active) return;
    obstacle.disableBody(true, true);
    this.damage();
  }

  private onMeteorHit(meteor: ArcadeSprite): void {
    if (!meteor.active) return;
    this.explode(meteor.x, meteor.y);
    meteor.disableBody(true, true);
    this.damage();
  }

  private onPitFall(): void {
    // หาแท่นถัดไปที่อยู่ข้างหน้า แล้ววางผู้เล่นลงตรงนั้น
    const next = this.segments
      .filter((s) => s.left > this.player.x)
      .sort((a, b) => a.left - b.left)[0];
    const x = next ? next.left + 70 : this.lastGroundedX;

    this.player.setPosition(x, GROUND_Y - 140);
    this.pbody.setVelocity(0, 0);
    this.damage();
  }

  private damage(): void {
    if (this.dead || this.time.now < this.invincibleUntilMs) return;

    this.hearts -= 1;
    this.invincibleUntilMs = this.time.now + BALANCE.player.invincibilityMs;
    sfx.hurt();
    this.cameras.main.shake(180, 0.008);

    // กระพริบให้เห็นว่ากำลังอมตะอยู่ (2.5 ครั้ง/วินาที — ต่ำกว่าเกณฑ์ WCAG)
    this.tweens.add({
      targets: this.player,
      alpha: { from: 1, to: 0.3 },
      duration: 200,
      yoyo: true,
      repeat: Math.floor(BALANCE.player.invincibilityMs / 400),
      onComplete: () => this.player.setAlpha(1),
    });

    if (this.hearts <= 0) this.fatal('hearts');
  }

  /**
   * ถึงจุดที่ควรตาย — แต่ถ้ายังมีสิทธิ์ฟื้น ให้ถามคำถามก่อน
   * ตอบถูก = กลับมาเล่นต่อจาก checkpoint ล่าสุด
   */
  private fatal(reason: EndReason): void {
    if (this.dead || this.reviving) return;

    if (this.revivesLeft > 0) {
      this.openRevive(reason);
      return;
    }
    this.endGame(reason);
  }

  private openRevive(reason: EndReason): void {
    this.pendingDeathReason = reason;
    this.reviving = true;
    this.quizActive = true;
    this.pendingKind = 'revive';

    this.pbody.setVelocity(0, 0);
    this.pbody.setAllowGravity(false);
    this.player.stop();
    this.player.setTexture('dino_jump');
    this.player.setTint(0xff8a8a);

    sfx.death();
    this.cameras.main.shake(320, 0.012);

    emitBus('quiz:open', { kind: 'revive', stage: this.stage });
  }

  private doRevive(): void {
    this.reviving = false;
    this.quizActive = false;
    this.revivesLeft -= 1;
    this.hearts = BALANCE.player.heartsOnRevive;

    // กลับไปยืนที่ checkpoint ล่าสุด แล้วผลักกำแพงถอยไปให้ตั้งหลักได้
    const x = Math.max(this.lastCheckpointX, this.startX);
    this.player.setPosition(x, GROUND_Y - 160);
    this.player.clearTint();
    this.pbody.setAllowGravity(true);
    this.pbody.setVelocity(0, 0);
    this.wallX = x - BALANCE.wall.maxGapPx * 0.75;
    this.invincibleUntilMs = this.time.now + 2200;

    sfx.go();
    this.cameras.main.flash(260, 155, 209, 123, false);
    this.floatText('♥', 0x9bd17b);
  }

  private explode(x: number, y: number): void {
    const emitter = this.add.particles(x, y, 'ember', {
      speed: { min: 60, max: 260 },
      angle: { min: 200, max: 340 },
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 520,
      quantity: 14,
      emitting: false,
    });
    emitter.setDepth(13);
    emitter.explode(14);
    this.time.delayedCall(700, () => emitter.destroy());
  }

  private onGateReached(gate: ArcadeSprite): void {
    if (this.quizActive || this.dead || gate.getData('used') === true) return;

    gate.setData('used', true);
    gate.disableBody(true, true);

    this.quizActive = true;
    this.lastCheckpointX = gate.x;
    this.pbody.setVelocityX(0);
    sfx.checkpoint();

    this.pendingKind = this.bossPending ? 'final' : 'main';
    emitBus('quiz:open', { kind: this.pendingKind, stage: this.stage });
  }

  private onQuizAnswered(isCorrect: boolean, kind: QuestionKind, points = 0): void {
    if (!this.quizActive) return;

    if (kind === 'revive') {
      if (isCorrect) this.doRevive();
      else this.endGame(this.pendingDeathReason);
      return;
    }

    this.quizActive = false;

    if (isCorrect) {
      // รางวัลที่จับต้องได้: กำแพงถอยห่างจริง
      this.wallX -= BALANCE.wall.pushBackOnCorrect;
      // โชว์คะแนนที่ได้จริงเป็นตัวเลข ไม่ใช่แค่เครื่องหมาย + เฉยๆ
      this.floatText(points > 0 ? `+${points}` : '+', 0x9bd17b);
      this.cameras.main.flash(160, 155, 209, 123, false);
    } else {
      // ไม่เสียหัวใจ ไม่เสียคะแนน — แค่กำแพงเร่งขึ้นชั่วคราว
      // (ดู docs/03-decisions.md Q1 ว่าทำไมถึงไม่ลงโทษความไม่รู้)
      this.wrongBoostAmount =
        kind === 'final' ? BALANCE.wall.finalWrongBoost : BALANCE.wall.speedUpOnWrong;
      this.wrongBoostUntilMs =
        this.time.now +
        (kind === 'final'
          ? BALANCE.wall.finalWrongDurationMs
          : BALANCE.wall.speedUpDurationMs);
      this.floatText('!', 0xff9c41);
    }

    if (kind === 'final') {
      // ตอบบอสถูก = ชนะ / ตอบผิด = ยังไม่จบ วิ่งต่อแล้วจะเจอบอสอีกครั้งที่ checkpoint ถัดไป
      if (isCorrect) this.endGame('victory');
      return;
    }

    // คำถามประจำด่าน: เดินหน้าต่อไม่ว่าจะตอบถูกหรือผิด
    // (ถ้าให้เฉพาะตอบถูกถึงจะผ่าน เด็กที่ไม่รู้จะติดอยู่ด่านเดิมตลอดไป)
    this.stageProgress += 1;
    if (this.stageProgress >= QUESTIONS_PER_STAGE) {
      this.stageProgress = 0;
      if (this.stage >= STAGE_COUNT) {
        this.bossPending = true;
      } else {
        this.stage += 1;
        emitBus('stage:changed', { stage: this.stage, name: this.stageConfig().name });
      }
    }
  }

  private floatText(symbol: string, color: number): void {
    this.floatTextAt(this.player.x, this.player.y - 90, symbol, color);
  }

  /** ตัวหนังสือลอยขึ้นแล้วจางหาย ณ จุดที่กำหนด */
  private floatTextAt(x: number, y: number, symbol: string, color: number, size = 38): void {
    const label = this.add
      .text(x, y, symbol, {
        fontFamily: 'Kanit, sans-serif',
        fontSize: `${size}px`,
        color: Phaser.Display.Color.IntegerToColor(color).rgba,
        stroke: '#1d1129',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(30);

    this.tweens.add({
      targets: label,
      y: y - 60,
      alpha: 0,
      duration: 900,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  private checkDeath(): void {
    if (this.dead || this.reviving || !this.started) return;
    if (this.wallX >= this.player.x - 18) this.fatal('wall');
  }

  private endGame(reason: EndReason): void {
    if (this.dead) return;
    this.dead = true;
    this.quizActive = false;
    this.reviving = false;

    stopMusic();

    const body = this.pbody;
    body.setAllowGravity(true);
    this.player.stop();

    if (reason === 'victory') {
      // ชนะ: กระโดดดีใจ + กำแพงถอยหายไป
      sfx.correct();
      this.player.clearTint();
      this.player.setTexture('dino_jump');
      body.setVelocity(140, -520);
      this.wallX = this.player.x - BALANCE.wall.maxGapPx;
      this.cameras.main.flash(400, 155, 209, 123, false);
      this.celebrate();
    } else {
      sfx.death();
      this.cameras.main.shake(400, 0.014);
      this.player.setTexture('dino_jump');
      this.player.setTint(0xff8a8a);
      body.setVelocity(0, -320);
    }

    this.time.delayedCall(reason === 'victory' ? 1100 : 650, () => {
      emitBus('game:over', {
        distanceM: Math.floor(this.distanceM),
        heartsLeft: Math.max(this.hearts, 0),
        durationMs: Math.round(this.elapsedMs),
        endReason: reason,
      });
    });
  }

  /** พลุตอนชนะ */
  private celebrate(): void {
    const emitter = this.add.particles(this.player.x, this.player.y - 60, 'sparkle', {
      speed: { min: 120, max: 420 },
      angle: { min: 200, max: 340 },
      scale: { start: 1.2, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 1200,
      quantity: 30,
      emitting: false,
    });
    emitter.setDepth(31);
    emitter.explode(40);
    this.time.delayedCall(1600, () => emitter.destroy());
  }

  private emitHud(delta: number): void {
    this.hudAccMs += delta;
    const interval = 1000 / BALANCE.perf.hudUpdateHz;
    if (this.hudAccMs < interval) return;
    this.hudAccMs = 0;

    emitBus('hud:update', {
      hearts: Math.max(this.hearts, 0),
      stage: this.bossPending ? STAGE_COUNT + 1 : this.stage,
      stageProgress: this.stageProgress,
      revivesLeft: this.revivesLeft,
      distanceM: Math.floor(this.distanceM),
      wallGapPx: Math.max(Math.round(this.player.x - this.wallX), 0),
      combo: 0,
      chaseStarted: this.started && this.elapsedMs >= BALANCE.wall.startDelayMs,
    });
  }
}
