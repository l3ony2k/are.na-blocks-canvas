const arenaAPI = (() => {
  const BASE_URL = 'https://api.are.na/v3';

  function buildHeaders(extraHeaders = {}) {
    const headers = { ...extraHeaders };

    if (CONFIG.accessToken && CONFIG.accessToken.trim()) {
      headers.Authorization = `Bearer ${CONFIG.accessToken.trim()}`;
    }

    return headers;
  }

  async function requestJson(path, options = {}) {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: buildHeaders(options.headers)
    });

    if (!response.ok) {
      let details = '';

      try {
        const errorBody = await response.json();
        details = errorBody.error || errorBody.message || JSON.stringify(errorBody);
      } catch (error) {
        details = response.statusText;
      }

      const detailSuffix = details ? `: ${details}` : '';
      throw new Error(`Are.na API ${response.status}${detailSuffix}`);
    }

    return response.json();
  }

  function normalizeRichContent(value) {
    if (!value || typeof value !== 'object') {
      return null;
    }

    return {
      markdown: value.markdown || '',
      html: value.html || '',
      plain: value.plain || ''
    };
  }

  function normalizeEntity(value) {
    if (!value || typeof value !== 'object') {
      return null;
    }

    return {
      id: value.id ?? null,
      type: value.type || null,
      name: value.name || value.full_name || value.title || null,
      slug: value.slug || null,
      avatar: value.avatar || null,
      initials: value.initials || null
    };
  }

  function normalizeSource(value) {
    if (!value || typeof value !== 'object' || !value.url) {
      return null;
    }

    return {
      url: value.url,
      title: value.title || value.url,
      provider: value.provider?.name || value.provider?.title || null
    };
  }

  function normalizeImageVersion(value) {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const url = value.src || value.url || null;
    if (!url) {
      return null;
    }

    return {
      url,
      url2x: value.src_2x || null,
      width: value.width ?? null,
      height: value.height ?? null
    };
  }

  function normalizeImageSet(value) {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const original = value.src ? {
      url: value.src,
      url2x: null,
      width: value.width ?? null,
      height: value.height ?? null
    } : null;

    const small = normalizeImageVersion(value.small);
    const medium = normalizeImageVersion(value.medium);
    const large = normalizeImageVersion(value.large);
    const square = normalizeImageVersion(value.square);
    const preview = small || medium || large || square || original;
    const display = medium || large || small || square || original;

    return {
      original,
      preview,
      thumb: small || square || medium || large || original,
      small,
      medium,
      display,
      large: large || medium || small || original,
      square,
      altText: value.alt_text || null,
      width: value.width ?? display?.width ?? original?.width ?? null,
      height: value.height ?? display?.height ?? original?.height ?? null,
      aspectRatio: value.aspect_ratio ?? null
    };
  }

  function normalizeConnection(value) {
    if (!value || typeof value !== 'object') {
      return null;
    }

    return {
      id: value.id ?? null,
      position: value.position ?? null,
      pinned: Boolean(value.pinned),
      connectedAt: value.connected_at || null,
      connectedBy: normalizeEntity(value.connected_by)
    };
  }

  function normalizeCounts(value) {
    if (!value || typeof value !== 'object') {
      return null;
    }

    return {
      blocks: value.blocks ?? null,
      channels: value.channels ?? null,
      contents: value.contents ?? null,
      collaborators: value.collaborators ?? null,
      followers: value.followers ?? null,
      following: value.following ?? null
    };
  }

  function normalizeKind(type) {
    switch (type) {
      case 'Channel':
        return 'channel';
      case 'Text':
        return 'text';
      case 'Image':
        return 'image';
      case 'Link':
        return 'link';
      case 'Attachment':
        return 'attachment';
      case 'Embed':
        return 'embed';
      default:
        return 'unknown';
    }
  }

  function normalizeArenaItem(value) {
    const description = normalizeRichContent(value.description);
    const content = normalizeRichContent(value.content);
    const kind = normalizeKind(value.type);
    const imageVersions = normalizeImageSet(value.image);

    return {
      id: value.id,
      kind,
      rawType: value.type || null,
      title: value.title || value.source?.title || null,
      slug: value.slug || null,
      descriptionHtml: description?.html || null,
      descriptionPlain: description?.plain || null,
      textHtml: content?.html || null,
      textPlain: content?.plain || null,
      visibility: value.visibility || null,
      state: value.state || null,
      createdAt: value.created_at || null,
      updatedAt: value.updated_at || null,
      owner: normalizeEntity(value.owner || value.user),
      source: normalizeSource(value.source),
      connection: normalizeConnection(value.connection),
      counts: normalizeCounts(value.counts),
      commentCount: value.comment_count ?? null,
      imageVersions,
      coverImageVersions: kind === 'channel' ? imageVersions : null,
      attachment: value.attachment || null,
      embed: value.embed || null,
      arenaUrl: kind === 'channel'
        ? `https://www.are.na/channel/${value.slug}`
        : `https://www.are.na/block/${value.id}`
    };
  }

  async function getChannel(id) {
    const data = await requestJson(`/channels/${encodeURIComponent(id)}`);
    return normalizeArenaItem(data);
  }

  async function getChannelContentsPage(id, page = 1, per = 100, sort = 'position_asc') {
    const params = new URLSearchParams({
      page: String(page),
      per: String(per),
      sort
    });

    const response = await requestJson(`/channels/${encodeURIComponent(id)}/contents?${params.toString()}`);

    return {
      data: Array.isArray(response.data) ? response.data.map(normalizeArenaItem) : [],
      meta: response.meta || {
        current_page: page,
        per_page: per,
        total_pages: 1,
        total_count: 0,
        has_more_pages: false
      }
    };
  }

  async function getAllChannelContents(id, options = {}) {
    const per = options.per || 100;
    const sort = options.sort || 'position_asc';
    const onPageLoaded = options.onPageLoaded;

    const firstPage = await getChannelContentsPage(id, 1, per, sort);
    const pages = [firstPage];
    let loaded = firstPage.data.length;

    if (onPageLoaded) {
      onPageLoaded({
        page: 1,
        loaded,
        pageCount: firstPage.data.length,
        total: firstPage.meta.total_count
      });
    }

    const remainingPages = [];
    for (let page = 2; page <= (firstPage.meta.total_pages || 1); page += 1) {
      remainingPages.push(
        getChannelContentsPage(id, page, per, sort)
          .then(result => ({ page, result }))
      );
    }

    const settled = await Promise.allSettled(remainingPages);
    const pageErrors = [];

    settled.forEach(entry => {
      if (entry.status === 'fulfilled') {
        pages[entry.value.page - 1] = entry.value.result;
        loaded += entry.value.result.data.length;

        if (onPageLoaded) {
          onPageLoaded({
            page: entry.value.page,
            loaded,
            pageCount: entry.value.result.data.length,
            total: firstPage.meta.total_count
          });
        }
      } else {
        pageErrors.push(entry.reason);
      }
    });

    const orderedPages = pages.filter(Boolean).sort((left, right) => {
      return left.meta.current_page - right.meta.current_page;
    });

    return {
      data: orderedPages.flatMap(page => page.data),
      meta: firstPage.meta,
      pageErrors
    };
  }

  async function getChannelFollowerCount(id) {
    const response = await Promise.race([
      requestJson(`/channels/${encodeURIComponent(id)}/followers?per=1&page=1`),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Follower request timed out')), 6000);
      })
    ]);
    return response.meta?.total_count ?? 0;
  }

  async function getMe() {
    const data = await requestJson('/me');
    return {
      id: data.id ?? null,
      slug: data.slug || null,
      name: data.name || null,
      avatar: data.avatar || null,
      initials: data.initials || null
    };
  }

  function normalizePagedList(response, page, per) {
    return {
      data: Array.isArray(response.data) ? response.data.map(normalizeArenaItem) : [],
      meta: response.meta || {
        current_page: page,
        per_page: per,
        total_pages: 1,
        total_count: 0,
        has_more_pages: false
      }
    };
  }

  // Channels created by a user; when authenticated as that user this
  // includes private channels. Note: the API currently inverts the
  // updated_at sort semantics on this endpoint (desc returns oldest first),
  // so ask for "asc" and additionally sort client-side, newest first.
  async function getUserChannelsPage(userId, page = 1, per = 100) {
    const params = new URLSearchParams({
      page: String(page),
      per: String(per),
      type: 'Channel',
      sort: 'updated_at_asc'
    });
    const response = await requestJson(`/users/${encodeURIComponent(userId)}/contents?${params.toString()}`);
    const result = normalizePagedList(response, page, per);
    result.data.sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')));
    return result;
  }

  // Channels a user follows. The API can only sort by follow date, so
  // callers re-sort by channel update time client-side.
  async function getUserFollowingChannelsPage(userId, page = 1, per = 100) {
    const params = new URLSearchParams({
      page: String(page),
      per: String(per),
      type: 'Channel'
    });
    const response = await requestJson(`/users/${encodeURIComponent(userId)}/following?${params.toString()}`);
    return normalizePagedList(response, page, per);
  }

  async function getUserProfile(userId) {
    const data = await requestJson(`/users/${encodeURIComponent(userId)}`);
    return {
      id: data.id ?? null,
      slug: data.slug || null,
      name: data.name || null,
      avatar: data.avatar || null,
      initials: data.initials || null,
      bioHtml: data.bio?.html || null,
      createdAt: data.created_at || null,
      counts: {
        channels: data.counts?.channels ?? null,
        followers: data.counts?.followers ?? null,
        following: data.counts?.following ?? null
      }
    };
  }

  // The authenticated user's activity feed; returns canvas-renderable
  // items extracted from feed activities, newest first.
  async function getFeedItems(limit = 100) {
    const response = await requestJson(`/me/feed?limit=${Math.min(100, limit)}`);
    const activities = Array.isArray(response.data) ? response.data : [];
    const renderable = new Set(['Text', 'Image', 'Link', 'Attachment', 'Embed', 'Channel']);
    const seen = new Set();
    const items = [];

    activities.forEach(activity => {
      const subject = activity?.item;
      if (!subject || !renderable.has(subject.type)) {
        return;
      }
      const key = `${subject.type}:${subject.id}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      items.push(normalizeArenaItem(subject));
    });

    return items;
  }

  // Channels a block appears in (its connections).
  async function getBlockConnectionsPage(blockId, page = 1, per = 24) {
    const params = new URLSearchParams({
      page: String(page),
      per: String(per),
      sort: 'created_at_desc'
    });
    const response = await requestJson(`/blocks/${encodeURIComponent(blockId)}/connections?${params.toString()}`);
    return normalizePagedList(response, page, per);
  }

  // Channels a channel appears in.
  async function getChannelConnectionsPage(id, page = 1, per = 24) {
    const params = new URLSearchParams({
      page: String(page),
      per: String(per),
      sort: 'created_at_desc'
    });
    const response = await requestJson(`/channels/${encodeURIComponent(id)}/connections?${params.toString()}`);
    return normalizePagedList(response, page, per);
  }

  async function getBlockCommentsPage(blockId, page = 1, per = 24) {
    const params = new URLSearchParams({
      page: String(page),
      per: String(per)
    });
    const response = await requestJson(`/blocks/${encodeURIComponent(blockId)}/comments?${params.toString()}`);
    return {
      data: (Array.isArray(response.data) ? response.data : []).map(comment => ({
        id: comment.id,
        bodyHtml: comment.body?.html || null,
        bodyPlain: comment.body?.plain || '',
        createdAt: comment.created_at || null,
        user: normalizeEntity(comment.user)
      })),
      meta: response.meta || { total_count: 0, has_more_pages: false, current_page: page }
    };
  }

  // Connect a block or channel to a target channel. Requires a write-scope token.
  async function createConnection(connectableId, channelId, connectableType = 'Block') {
    const response = await requestJson('/connections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connectable_type: connectableType,
        connectable_id: connectableId,
        channels: [{ id: channelId }]
      })
    });
    const connection = Array.isArray(response.data) ? response.data[0] : response.data;
    return { id: connection?.id ?? null };
  }

  async function deleteConnection(connectionId) {
    const response = await fetch(`${BASE_URL}/connections/${encodeURIComponent(connectionId)}`, {
      method: 'DELETE',
      headers: buildHeaders()
    });
    if (!response.ok && response.status !== 204) {
      throw new Error(`Are.na API ${response.status}`);
    }
  }

  return {
    getChannel,
    getChannelContentsPage,
    getAllChannelContents,
    getChannelFollowerCount,
    getMe,
    getUserChannelsPage,
    getUserFollowingChannelsPage,
    getUserProfile,
    getFeedItems,
    getBlockConnectionsPage,
    getChannelConnectionsPage,
    getBlockCommentsPage,
    createConnection,
    deleteConnection,
    normalizeArenaItem
  };
})();

async function fetchChannelInfo(slug) {
  outputLog(`[fetchChannelInfo] Fetching channel "${slug}" info...`);

  try {
    const channel = await arenaAPI.getChannel(slug);
    outputLog(`[fetchChannelInfo] Channel "${slug}" info: ${channel.title}`);
    return channel;
  } catch (error) {
    outputLog(`[fetchChannelInfo] Error fetching channel info: ${error.message}`);
    return null;
  }
}
