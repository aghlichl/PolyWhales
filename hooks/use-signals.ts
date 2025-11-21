"use client";

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export interface EnrichedTrade {
  type: string;
  market: {
    question: string;
    outcome: string;
    conditionId: string;
    odds: number;
  };
  trade: {
    assetId: string;
    size: number;
    side: string;
    price: number;
    value: number;
    timestamp: Date | string;
  };
  analysis: {
    tags: string[];
    wallet_context: {
      label: string;
      pnl_all_time: string;
      win_rate: string;
      is_fresh_wallet: boolean;
    };
    market_impact: {
      swept_levels: number;
      slippage_induced: string;
    };
  };
}

export function useSignals() {
  const [trades, setTrades] = useState<EnrichedTrade[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Fetch initial history
    async function fetchHistory() {
      try {
        const response = await fetch('/api/history');
        if (response.ok) {
          const data = await response.json();
          setTrades(data);
        }
      } catch (error) {
        console.error('[useSignals] Error fetching history:', error);
      }
    }

    fetchHistory();

    // Connect to Socket.io server
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[useSignals] Connected to Socket.io');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[useSignals] Disconnected from Socket.io');
      setIsConnected(false);
    });

    socket.on('trade', (trade: EnrichedTrade) => {
      // Add new trade to the beginning of the list
      setTrades((prev) => [trade, ...prev].slice(0, 100)); // Keep last 100 trades
    });

    socket.on('error', (error) => {
      console.error('[useSignals] Socket error:', error);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return {
    trades,
    isConnected,
  };
}

