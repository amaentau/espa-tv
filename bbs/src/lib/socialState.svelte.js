// Shared state for social counts and reactions using Svelte 5 runes
export const socialState = $state({
  stats: {}, // rowKey -> { commentCount: number, reactions: { emoji: count } }
  
  updateStats(targetId, data) {
    this.stats[targetId] = {
      commentCount: data.comments?.length || 0,
      reactions: data.reactions || {}
    };
  },

  async fetchStats(targetId, token) {
    try {
      const res = await fetch(`/social/${targetId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      this.updateStats(targetId, data);
    } catch (err) {
      console.error('Failed to fetch social stats:', err);
    }
  }
});

