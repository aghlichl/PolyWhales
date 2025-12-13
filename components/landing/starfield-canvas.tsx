"use client";

import React, { useRef, useEffect } from "react";

interface Star {
    x: number;
    y: number;
    z: number;
    size: number;
    opacity: number;
}

export function StarfieldCanvas() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const starsRef = useRef<Star[]>([]);
    const rafRef = useRef<number | null>(null);

    // raw mouse + smoothed mouse
    const mouseRef = useRef({ x: 0, y: 0 });
    const mouseSmoothedRef = useRef({ x: 0, y: 0 });

    // store viewport so we don't read innerWidth/innerHeight every loop
    const viewRef = useRef({ w: 0, h: 0, cx: 0, cy: 0 });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) return;

        // Tweakables
        const STAR_COUNT = 1200;
        const DEPTH = 2000;
        const FOV = 350;
        const SPEED_PER_SEC = 350;

        const MAX_YAW = 0.75;
        const MAX_PITCH = 0.60;

        // Feel knobs (these are the ones you’ll actually tune)
        const INPUT_SMOOTH_HZ = 18;      // higher = snappier mouse, lower = floatier
        const ROT_SMOOTH_TIME = 0.14;    // seconds; lower = tighter, higher = more glide
        const ROT_MAX_SPEED = 4.0;       // rad/sec clamp to avoid violent jumps

        let yaw = 0;
        let pitch = 0;
        let yawVel = 0;
        let pitchVel = 0;
        let lastT = performance.now();

        const initStars = () => {
            const { w, h } = viewRef.current;
            const spread = Math.max(w, h) * 2.2;

            const stars: Star[] = [];
            for (let i = 0; i < STAR_COUNT; i++) {
                stars.push({
                    x: (Math.random() - 0.5) * spread,
                    y: (Math.random() - 0.5) * spread,
                    z: Math.random() * DEPTH + 1,
                    size: Math.random() * 1.8 + 0.4,
                    opacity: Math.random() * 0.7 + 0.3,
                });
            }
            starsRef.current = stars;
        };

        const resize = () => {
            const dpr = window.devicePixelRatio || 1;
            const w = window.innerWidth;
            const h = window.innerHeight;

            viewRef.current = { w, h, cx: w / 2, cy: h / 2 };

            canvas.width = Math.floor(w * dpr);
            canvas.height = Math.floor(h * dpr);
            canvas.style.width = `${w}px`;
            canvas.style.height = `${h}px`;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            if (starsRef.current.length === 0) initStars();

            // init mouse positions to center to avoid first-frame snap
            mouseRef.current = { x: w / 2, y: h / 2 };
            mouseSmoothedRef.current = { x: w / 2, y: h / 2 };
        };

        const onPointerMove = (e: PointerEvent) => {
            mouseRef.current = { x: e.clientX, y: e.clientY };
        };

        // Unity-style smooth damp (critically damped spring)
        const smoothDamp = (
            current: number,
            target: number,
            currentVelocity: number,
            smoothTime: number,
            maxSpeed: number,
            dt: number
        ) => {
            smoothTime = Math.max(0.0001, smoothTime);
            const omega = 2 / smoothTime;

            const x = omega * dt;
            const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);

            let change = current - target;
            const originalTarget = target;

            // clamp maximum change
            const maxChange = maxSpeed * smoothTime;
            change = Math.max(-maxChange, Math.min(maxChange, change));
            target = current - change;

            const temp = (currentVelocity + omega * change) * dt;
            const newVelocity = (currentVelocity - omega * temp) * exp;
            let output = target + (change + temp) * exp;

            // prevent overshoot
            const origMinusCurrent = originalTarget - current;
            const outMinusOrig = output - originalTarget;
            if (origMinusCurrent * outMinusOrig > 0) {
                output = originalTarget;
                return { value: output, velocity: 0 };
            }

            return { value: output, velocity: newVelocity };
        };

        const animate = (t: number) => {
            const dt = Math.min(0.033, (t - lastT) / 1000);
            lastT = t;

            const { w, h, cx, cy } = viewRef.current;

            // 1) dt-based mouse smoothing (tiny “glide” even before rotation)
            {
                const alpha = 1 - Math.exp(-INPUT_SMOOTH_HZ * dt);
                const mx = mouseSmoothedRef.current.x + (mouseRef.current.x - mouseSmoothedRef.current.x) * alpha;
                const my = mouseSmoothedRef.current.y + (mouseRef.current.y - mouseSmoothedRef.current.y) * alpha;
                mouseSmoothedRef.current = { x: mx, y: my };
            }

            // normalized mouse [-1..1] using smoothed mouse
            const nx = (mouseSmoothedRef.current.x - cx) / cx;
            const ny = (mouseSmoothedRef.current.y - cy) / cy;

            // optional: nicer “ease” near edges (prevents harsh saturation)
            const ease = (v: number) => Math.tanh(v * 1.25);
            const targetYaw = ease(nx) * MAX_YAW;
            const targetPitch = ease(ny) * MAX_PITCH;

            // 2) dt-based spring rotation (this is the big fluidity win)
            {
                const y = smoothDamp(yaw, targetYaw, yawVel, ROT_SMOOTH_TIME, ROT_MAX_SPEED, dt);
                yaw = y.value; yawVel = y.velocity;

                const p = smoothDamp(pitch, targetPitch, pitchVel, ROT_SMOOTH_TIME, ROT_MAX_SPEED, dt);
                pitch = p.value; pitchVel = p.velocity;
            }

            // clear
            ctx.fillStyle = "#050505";
            ctx.fillRect(0, 0, w, h);

            const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
            const cosX = Math.cos(pitch), sinX = Math.sin(pitch);
            const spread = Math.max(w, h) * 2.2;

            for (const star of starsRef.current) {
                star.z -= SPEED_PER_SEC * dt;

                if (star.z <= 1) {
                    star.z = DEPTH;
                    star.x = (Math.random() - 0.5) * spread;
                    star.y = (Math.random() - 0.5) * spread;
                }

                let x = star.x;
                let y = star.y;
                let z = star.z;

                // yaw
                {
                    const x1 = x * cosY - z * sinY;
                    const z1 = x * sinY + z * cosY;
                    x = x1; z = z1;
                }

                // pitch
                {
                    const y1 = y * cosX - z * sinX;
                    const z1 = y * sinX + z * cosX;
                    y = y1; z = z1;
                }

                if (z <= 1) continue;

                const scale = FOV / z;
                const sx = x * scale + cx;
                const sy = y * scale + cy;
                if (sx < 0 || sx > w || sy < 0 || sy > h) continue;

                const r = star.size * scale;
                const a = star.opacity * Math.min(1, scale * 1.8);

                const glow = Math.max(0, (scale - 0.8) / 0.6);
                if (glow > 0) {
                    ctx.beginPath();
                    ctx.fillStyle = `rgba(0, 255, 148, ${a * glow * 0.35})`;
                    ctx.arc(sx, sy, r * 3.2, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.beginPath();
                ctx.fillStyle = `rgba(255,255,255,${a})`;
                ctx.arc(sx, sy, Math.max(0.6, r), 0, Math.PI * 2);
                ctx.fill();
            }

            rafRef.current = requestAnimationFrame(animate);
        };

        window.addEventListener("resize", resize);
        window.addEventListener("pointermove", onPointerMove, { passive: true });

        resize();
        rafRef.current = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener("resize", resize);
            window.removeEventListener("pointermove", onPointerMove);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 w-full h-full pointer-events-none z-0"
            style={{ background: "#050505" }}
        />
    );
}
