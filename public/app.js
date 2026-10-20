const { createApp, ref, reactive, computed, onMounted, onUnmounted } = Vue;

createApp({
  setup() {
    // State
    const groups = ref([]);
    const bookmarkGroups = ref([]);
    const activeTab = ref('services');
    const showPreview = ref(true);
    const previewUrl = ref('https://home.928202333.xyz');
    const previewKey = ref(0);
    const previewCollapsed = ref(false);
    const isResizing = ref(false);
    // Share of .main-content given to the editor; the preview takes the rest.
    // 60/40 matches the original CSS default (preview panel was 40%).
    const splitRatio = ref(60);
    const viewportWidth = ref(window.innerWidth);
    const saving = ref(false);
    const showGroupModal = ref(false);
    const showItemModal = ref(false);
    const showMoveModal = ref(false);
    const showBackups = ref(false);
    const editingGroupId = ref(null);
    const editingItemId = ref(null);
    const movingItem = ref(null);
    const movingFromGroup = ref(null);
    const dragOverGroup = ref(null);
    const backups = ref([]);
    const toast = reactive({ show: false, msg: '', type: 'success' });

    const editingGroup = reactive({ name: '', colSpan: 1 });
    const editingItem = reactive({
      name: '', href: '', description: '', target: '',
      icon: '', iconType: 'mdi', widgetType: 'none', widgetValue: ''
    });

    // Drag state
    let dragSource = null;

    // Computed
    const totalItems = computed(() => groups.value.reduce((sum, g) => sum + g.items.length, 0));
    const isColumn = computed(() => viewportWidth.value > 768);

    // Layout: the preview panel keeps a fixed flex-basis while the editor fills whatever
    // is left, so collapsing actually moves the divider instead of only hiding the iframe.
    const COLLAPSED_COLUMN_WIDTH = 44;
    const COLLAPSED_MOBILE_HEIGHT = 38;

    const editorPanelStyle = computed(() => {
      if (!showPreview.value) return {};
      return isColumn.value
        ? { flex: '1 1 0', width: 'auto', minWidth: '0' }
        : { flex: '1 1 0', height: 'auto', minHeight: '0' };
    });

    const previewPanelStyle = computed(() => {
      if (!showPreview.value) return {};
      if (isColumn.value) {
        const basis = previewCollapsed.value
          ? COLLAPSED_COLUMN_WIDTH + 'px'
          : (100 - splitRatio.value) + '%';
        return {
          flex: '0 0 ' + basis,
          width: basis,
          minWidth: '0',
          maxWidth: previewCollapsed.value ? COLLAPSED_COLUMN_WIDTH + 'px' : 'none'
        };
      }
      const basis = previewCollapsed.value
        ? COLLAPSED_MOBILE_HEIGHT + 'px'
        : (100 - splitRatio.value) + '%';
      return {
        flex: '0 0 ' + basis,
        height: basis,
        minHeight: '0',
        maxHeight: previewCollapsed.value ? COLLAPSED_MOBILE_HEIGHT + 'px' : 'none'
      };
    });

    // The shell must be exactly as tall as the area the user can see. dvh is only a
    // starting guess: on some mobile browsers it resolves to the layout viewport (the
    // URL-bar-hidden height) instead of the visible area, which pushes the bottom of the
    // shell - including the collapsed preview strip and the last service group - below
    // the reachable part of the screen while overflow is hidden. Measuring the visual
    // viewport directly is what keeps that from happening.
    function visibleHeight() {
      const vv = window.visualViewport;
      // When zoomed in, the visual viewport is only the magnified slice; lay out against
      // the layout viewport instead so the page is not shrunk to the zoom window.
      if (vv && vv.scale && vv.scale > 1.01) return window.innerHeight;
      // The reachable area is never larger than either viewport reports, so take the
      // smaller of the two. On mobile Chrome/Firefox innerHeight is the large layout
      // viewport while visualViewport is the visible area; on iOS innerHeight already
      // tracks the visible area. The minimum is correct in both cases.
      return vv ? Math.min(window.innerHeight, vv.height) : window.innerHeight;
    }

    let syncScheduled = false;
    let lastAppliedHeight = 0;
    function applyViewport() {
      syncScheduled = false;
      viewportWidth.value = window.innerWidth;
      const h = Math.round(visibleHeight());
      // visualViewport scrolls constantly while the page is panned, so only write when the
      // measured height actually changes; a redundant write would force needless layout.
      if (h > 0 && h !== lastAppliedHeight) {
        lastAppliedHeight = h;
        document.documentElement.style.setProperty('--app-height', h + 'px');
      }
    }

    function syncViewport() {
      // Coalesce the burst of resize/scroll events the URL bar produces into one layout.
      if (syncScheduled) return;
      syncScheduled = true;
      requestAnimationFrame(applyViewport);
    }

    const widgetValueLabel = computed(() => {
      switch (editingItem.widgetType) {
        case 'container': return '容器名稱';
        case 'ping': return 'IP 位址';
        case 'customapi': return 'API URL';
        default: return '值';
      }
    });

    const widgetValuePlaceholder = computed(() => {
      switch (editingItem.widgetType) {
        case 'container': return '例如：code-server';
        case 'ping': return '例如：192.168.1.110';
        case 'customapi': return 'https://.../api/health';
        default: return '';
      }
    });

    // Helpers
    function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

    function showToast(msg, type = 'success') {
      toast.msg = msg;
      toast.type = type;
      toast.show = true;
      setTimeout(() => { toast.show = false; }, 3000);
    }

    function widgetTypeLabel(type) {
      const map = { container: '容器', ping: 'Ping', customapi: 'API', none: '無' };
      return map[type] || '無';
    }

    // Load data
    async function loadServices() {
      try {
        const res = await fetch('/api/services');
        const json = await res.json();
        if (json.success && json.data) {
          groups.value = parseYamlData(json.data);
        }
      } catch (err) {
        showToast('載入失敗: ' + err.message, 'error');
      }
    }

    // Load bookmarks
    async function loadBookmarks() {
      try {
        const res = await fetch('/api/bookmarks');
        const json = await res.json();
        if (json.success && json.data) {
          bookmarkGroups.value = parseBookmarkData(json.data);
        }
      } catch (err) {
        showToast('載入書籤失敗: ' + err.message, 'error');
      }
    }

    function parseBookmarkData(data) {
      if (!Array.isArray(data)) return [];
      return data.map(groupObj => {
        const name = Object.keys(groupObj)[0];
        const items = groupObj[name] || [];
        return {
          id: uid(),
          name,
          collapsed: false,
          items: items.map(item => {
            const itemName = Object.keys(item)[0];
            const confArr = item[itemName] || [];
            const conf = Array.isArray(confArr) && confArr.length > 0 ? confArr[0] : {};
            return {
              id: uid(),
              name: itemName,
              abbr: conf.abbr || itemName.slice(0, 2).toUpperCase(),
              href: conf.href || ''
            };
          })
        };
      });
    }

    function parseYamlData(data) {
      if (!Array.isArray(data)) return [];
      return data.map(groupObj => {
        const name = Object.keys(groupObj)[0];
        const items = groupObj[name] || [];
        return {
          id: uid(),
          name,
          colSpan: 1,
          collapsed: false,
          items: items.map(item => {
            const itemName = Object.keys(item)[0];
            const conf = item[itemName] || {};
            let widgetType = 'none';
            let widgetValue = '';
            if (conf.container) { widgetType = 'container'; widgetValue = conf.container; }
            else if (conf.ping) { widgetType = 'ping'; widgetValue = conf.ping; }
            else if (conf.customapi) { widgetType = 'customapi'; widgetValue = conf.customapi; }
            let iconType = 'mdi';
            let icon = conf.icon || '';
            if (icon && !icon.startsWith('mdi-') && icon.startsWith('http')) iconType = 'url';
            return {
              id: uid(),
              name: itemName,
              href: conf.href || '',
              description: conf.description || '',
              target: conf.target || '',
              icon, iconType, widgetType, widgetValue
            };
          })
        };
      });
    }

    // Save
    async function save() {
      saving.value = true;
      try {
        const yaml = buildYaml();
        const res = await fetch('/api/services', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw: yaml })
        });
        const json = await res.json();
        if (json.success) {
          showToast('已儲存');
          refreshPreview();
        } else {
          showToast('儲存失敗: ' + json.error, 'error');
        }
      } catch (err) {
        showToast('儲存失敗: ' + err.message, 'error');
      }
      saving.value = false;
    }

    async function saveAll() {
      saving.value = true;
      try {
        const [svcRes, bmRes] = await Promise.all([
          fetch('/api/services', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ raw: buildYaml() })
          }),
          fetch('/api/bookmarks', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ raw: buildBookmarkYaml() })
          })
        ]);
        const svcJson = await svcRes.json();
        const bmJson = await bmRes.json();
        if (svcJson.success && bmJson.success) {
           showToast('已儲存');
           refreshPreview();
         } else {
           showToast('儲存失敗', 'error');
         }
       } catch (err) {
         showToast('儲存失敗: ' + err.message, 'error');
       }
       saving.value = false;
     }

    function buildYaml() {
      const lines = ['---', '# For configuration options and examples, please see:', '# https://gethomepage.dev/configs/services/', ''];
      groups.value.forEach(group => {
        lines.push('- ' + group.name + ':');
        group.items.forEach(item => {
          lines.push('    - ' + item.name + ':');
          if (item.href) lines.push('        href: ' + item.href);
          if (item.target) lines.push('        target: ' + item.target);
          if (item.description) lines.push('        description: ' + item.description);
          if (item.icon) lines.push('        icon: ' + item.icon);
          if (item.widgetType === 'container' && item.widgetValue) lines.push('        container: ' + item.widgetValue);
          if (item.widgetType === 'ping' && item.widgetValue) lines.push('        ping: ' + item.widgetValue);
          if (item.widgetType === 'customapi' && item.widgetValue) lines.push('        customapi: ' + item.widgetValue);
        });
        lines.push('');
      });
      return lines.join('\n');
    }

    // Group CRUD
    function addGroup() {
      editingGroupId.value = null;
      editingGroup.name = '';
      editingGroup.colSpan = 1;
      showGroupModal.value = true;
    }

    function editGroup(group) {
      editingGroupId.value = group.id;
      editingGroup.name = group.name;
      editingGroup.colSpan = group.colSpan || 1;
      showGroupModal.value = true;
    }

    function saveGroup() {
      if (!editingGroup.name.trim()) { showToast('請輸入分組名稱', 'error'); return; }
      if (editingGroupId.value) {
        const g = groups.value.find(g => g.id === editingGroupId.value);
        if (g) { g.name = editingGroup.name.trim(); g.colSpan = editingGroup.colSpan; }
      } else {
        groups.value.push({
          id: uid(), name: editingGroup.name.trim(),
          colSpan: editingGroup.colSpan, collapsed: false, items: []
        });
      }
      showGroupModal.value = false;
    }

    function deleteGroup(gi) {
      const g = groups.value[gi];
      if (!confirm('確定刪除分組「' + g.name + '」及其 ' + g.items.length + ' 個服務？')) return;
      groups.value.splice(gi, 1);
    }

    function toggleGroup(group) { group.collapsed = !group.collapsed; }

    // Bookmark CRUD
    function toggleBookmarkGroup(group) { group.collapsed = !group.collapsed; }

    function addBookmarkGroup() {
      const name = prompt('請輸入書籤分組名稱：');
      if (!name || !name.trim()) return;
      bookmarkGroups.value.push({ id: uid(), name: name.trim(), collapsed: false, items: [] });
    }

    function editBookmarkGroup(group) {
      const name = prompt('請輸入分組名稱：', group.name);
      if (!name || !name.trim()) return;
      group.name = name.trim();
    }

    function deleteBookmarkGroup(gi) {
      const g = bookmarkGroups.value[gi];
      if (!confirm('確定刪除書籤分組「' + g.name + '」？')) return;
      bookmarkGroups.value.splice(gi, 1);
    }

    function addBookmarkItem(group) {
      const name = prompt('請輸入書籤名稱：');
      if (!name || !name.trim()) return;
      const href = prompt('請輸入連結：');
      if (!href || !href.trim()) return;
      const abbr = prompt('請輸入縮寫（2-3個字元）：', name.trim().slice(0, 2).toUpperCase());
      group.items.push({
        id: uid(), name: name.trim(),
        abbr: (abbr || name.trim().slice(0, 2).toUpperCase()).toUpperCase(),
        href: href.trim()
      });
    }

    function editBookmarkItem(group, item) {
      const name = prompt('請輸入書籤名稱：', item.name);
      if (!name || !name.trim()) return;
      const href = prompt('請輸入連結：', item.href);
      if (!href || !href.trim()) return;
      const abbr = prompt('請輸入縮寫：', item.abbr);
      item.name = name.trim();
      item.href = href.trim();
      item.abbr = (abbr || '').toUpperCase();
    }

    function deleteBookmarkItem(group, ii) {
      if (!confirm('確定刪除書籤「' + group.items[ii].name + '」？')) return;
      group.items.splice(ii, 1);
    }

    function buildBookmarkYaml() {
      const lines = ['---', '# For configuration options and examples, please see:', '# https://gethomepage.dev/configs/bookmarks', ''];
      bookmarkGroups.value.forEach(group => {
        lines.push('- ' + group.name + ':');
        group.items.forEach(item => {
          lines.push('    - ' + item.name + ':');
          lines.push('        - abbr: ' + item.abbr);
          lines.push('          href: ' + item.href);
        });
        lines.push('');
      });
      return lines.join('\n');
    }

    async function saveBookmarks() {
      try {
        const yaml = buildBookmarkYaml();
        const res = await fetch('/api/bookmarks', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw: yaml })
        });
        const json = await res.json();
        if (json.success) {
          showToast('書籤已儲存');
        } else {
          showToast('書籤儲存失敗: ' + json.error, 'error');
        }
      } catch (err) {
        showToast('書籤儲存失敗: ' + err.message, 'error');
      }
    }

    // Item CRUD
    function addItem(group) {
      editingItemId.value = null;
      Object.assign(editingItem, {
        name: '', href: '', description: '', target: '',
        icon: '', iconType: 'mdi', widgetType: 'none', widgetValue: ''
      });
      editingItem._targetGroupId = group.id;
      showItemModal.value = true;
    }

    function editItem(group, item) {
      editingItemId.value = item.id;
      Object.assign(editingItem, {
        name: item.name, href: item.href, description: item.description,
        target: item.target, icon: item.icon, iconType: item.iconType,
        widgetType: item.widgetType, widgetValue: item.widgetValue
      });
      editingItem._targetGroupId = group.id;
      showItemModal.value = true;
    }

    function saveItem() {
      if (!editingItem.name.trim()) { showToast('請輸入服務名稱', 'error'); return; }
      const group = groups.value.find(g => g.id === editingItem._targetGroupId);
      if (!group) { showToast('找不到目標分組', 'error'); return; }
      if (editingItemId.value) {
        const item = group.items.find(i => i.id === editingItemId.value);
        if (item) {
          Object.assign(item, {
            name: editingItem.name.trim(), href: editingItem.href.trim(),
            description: editingItem.description.trim(), target: editingItem.target,
            icon: editingItem.icon.trim(), iconType: editingItem.iconType,
            widgetType: editingItem.widgetType, widgetValue: editingItem.widgetValue.trim()
          });
        }
      } else {
        group.items.push({
          id: uid(), name: editingItem.name.trim(), href: editingItem.href.trim(),
          description: editingItem.description.trim(), target: editingItem.target,
          icon: editingItem.icon.trim(), iconType: editingItem.iconType,
          widgetType: editingItem.widgetType, widgetValue: editingItem.widgetValue.trim()
        });
      }
      showItemModal.value = false;
    }

    function deleteItem(group, ii) {
      if (!confirm('確定刪除「' + group.items[ii].name + '」？')) return;
      group.items.splice(ii, 1);
    }

    // Move item
    function moveItemToGroup(group, item) {
      movingItem.value = item;
      movingFromGroup.value = group;
      showMoveModal.value = true;
    }

    function confirmMove(targetGroup) {
      if (movingFromGroup.value === targetGroup) { showMoveModal.value = false; return; }
      const idx = movingFromGroup.value.items.indexOf(movingItem.value);
      if (idx > -1) movingFromGroup.value.items.splice(idx, 1);
      targetGroup.items.push(movingItem.value);
      showMoveModal.value = false;
      showToast('已移動到「' + targetGroup.name + '」');
    }

    // Drag & Drop
    function onDragStart(event, group, item) {
      dragSource = { group, item };
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', item.id);
    }

    function onDragOver(event, group) {
      event.dataTransfer.dropEffect = 'move';
      dragOverGroup.value = group.id;
    }

    function onDrop(event, targetGroup) {
      dragOverGroup.value = null;
      if (!dragSource) return;
      const { group: srcGroup, item } = dragSource;
      if (srcGroup === targetGroup) {
        // Reorder within same group
        const oldIdx = srcGroup.items.indexOf(item);
        srcGroup.items.splice(oldIdx, 1);
        srcGroup.items.push(item);
      } else {
        // Move to different group
        const idx = srcGroup.items.indexOf(item);
        if (idx > -1) srcGroup.items.splice(idx, 1);
        targetGroup.items.push(item);
      }
      dragSource = null;
    }

    function onDragEnd() {
      dragOverGroup.value = null;
      dragSource = null;
    }

    // Preview
    function togglePreview() { showPreview.value = !showPreview.value; }
    function refreshPreview() { previewKey.value++; }
    function togglePreviewCollapsed() { previewCollapsed.value = !previewCollapsed.value; }
    // Resize logic
    function startResize(e) {
      isResizing.value = true;
      // Dragging the divider is a request to see both panes, so restore the preview first.
      if (previewCollapsed.value) previewCollapsed.value = false;
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onResize);
      document.addEventListener('mouseup', stopResize);
      document.addEventListener('touchmove', onResize);
      document.addEventListener('touchend', stopResize);
    }

    function onResize(e) {
      if (!isResizing.value) return;
      const mainContent = document.querySelector('.main-content');
      if (!mainContent) return;
      const rect = mainContent.getBoundingClientRect();
      let ratio;
      if (isColumn.value) {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        ratio = ((clientX - rect.left) / rect.width) * 100;
      } else {
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        ratio = ((clientY - rect.top) / rect.height) * 100;
      }
      splitRatio.value = Math.max(20, Math.min(80, ratio));
    }

    function stopResize() {
      isResizing.value = false;
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onResize);
      document.removeEventListener('mouseup', stopResize);
      document.removeEventListener('touchmove', onResize);
      document.removeEventListener('touchend', stopResize);
    }


    // Backups
    async function loadBackups() {
      try {
        const res = await fetch('/api/backups');
        const json = await res.json();
        if (json.success) backups.value = json.backups;
        showBackups.value = true;
      } catch (err) {
        showToast('載入備份失敗', 'error');
      }
    }

    async function restoreBackup(filename) {
      if (!confirm('確定還原備份「' + filename + '」？目前的配置會被覆蓋。')) return;
      try {
        const res = await fetch('/api/restore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename })
        });
        const json = await res.json();
        if (json.success) {
          showToast('已還原');
          loadServices();
          showBackups.value = false;
        } else {
          showToast('還原失敗: ' + json.error, 'error');
        }
      } catch (err) {
        showToast('還原失敗: ' + err.message, 'error');
      }
    }

    onMounted(() => {
      syncViewport();
      loadServices();
      loadBookmarks();
      window.addEventListener('resize', syncViewport);
      window.addEventListener('orientationchange', syncViewport);
      // Mobile URL-bar show/hide does not always fire window resize, and can also arrive
      // as a visual-viewport scroll, so listen for both.
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', syncViewport);
        window.visualViewport.addEventListener('scroll', syncViewport);
      }
    });

    onUnmounted(() => {
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', syncViewport);
        window.visualViewport.removeEventListener('scroll', syncViewport);
      }
    });

    return {
      groups, bookmarkGroups, activeTab, showPreview, previewUrl, previewKey, saving,
      showGroupModal, showItemModal, showMoveModal, showBackups,
      editingGroupId, editingItem, editingGroup,
      movingItem, movingFromGroup, dragOverGroup, backups, toast,
      totalItems, widgetValueLabel, widgetValuePlaceholder,
      loadServices, loadBookmarks, save, saveAll, addGroup, editGroup, saveGroup, deleteGroup, toggleGroup,
      addItem, editItem, saveItem, deleteItem,
      moveItemToGroup, confirmMove,
      onDragStart, onDragOver, onDrop, onDragEnd,
      togglePreview, togglePreviewCollapsed, refreshPreview, loadBackups, restoreBackup,
      previewCollapsed, isColumn, isResizing, splitRatio, startResize, onResize, stopResize,
      editorPanelStyle, previewPanelStyle,
      widgetTypeLabel,
      toggleBookmarkGroup, addBookmarkGroup, editBookmarkGroup, deleteBookmarkGroup,
      addBookmarkItem, editBookmarkItem, deleteBookmarkItem
    };
  }
}).mount('#app');
