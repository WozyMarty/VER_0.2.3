// Lightweight column resizer
// Adds a .resizer element to each TH and updates column widths using <colgroup>
(function(){
  function createColgroup(table){
    let colgroup = table.querySelector('colgroup');
    const ths = table.querySelectorAll('thead th');
    if(!colgroup){
      colgroup = document.createElement('colgroup');
      ths.forEach(()=>{
        const c = document.createElement('col');
        colgroup.appendChild(c);
      });
      table.insertBefore(colgroup, table.firstChild);
    } else {
      // ensure col count matches
      while(colgroup.children.length < ths.length) colgroup.appendChild(document.createElement('col'));
      while(colgroup.children.length > ths.length) colgroup.removeChild(colgroup.lastChild);
    }
    return colgroup;
  }

  function init(table){
    const ths = Array.from(table.querySelectorAll('thead th'));
    if(ths.length === 0) return;
    const colgroup = createColgroup(table);

    // restore widths from sessionStorage if available
    const key = 'colWidths:' + (table.id || table.getAttribute('data-table-key') || window.location.pathname);
    const initKey = 'colInitWidths:' + (table.id || table.getAttribute('data-table-key') || window.location.pathname);

    // save initial widths if not already saved
    if(!sessionStorage.getItem(initKey)){
      const initial = Array.from(colgroup.children).map(c=>c.style.width || getComputedStyle(c).width);
      sessionStorage.setItem(initKey, JSON.stringify(initial));
    }

    const saved = sessionStorage.getItem(key);
    if(saved){
      const arr = JSON.parse(saved);
      arr.forEach((w,i)=>{ if(colgroup.children[i]) colgroup.children[i].style.width = w; });
    }

    ths.forEach((th, index)=>{
      // avoid adding multiple resizers
      if(th.querySelector('.resizer')) return;
      const resizer = document.createElement('div');
      resizer.className = 'resizer';
      th.appendChild(resizer);

      let startX, startWidth, col;
      const mouseMove = (e)=>{
        const dx = e.clientX - startX;
        const newWidth = Math.max(30, startWidth + dx);
        if(col) col.style.width = newWidth + 'px';
      };
      const mouseUp = ()=>{
        document.removeEventListener('mousemove', mouseMove);
        document.removeEventListener('mouseup', mouseUp);
        // persist widths
        const widths = Array.from(colgroup.children).map(c=>c.style.width || getComputedStyle(c).width);
        sessionStorage.setItem(key, JSON.stringify(widths));
      };

      resizer.addEventListener('mousedown', (e)=>{
        e.preventDefault();
        startX = e.clientX;
        col = colgroup.children[index];
        startWidth = parseInt(getComputedStyle(col).width) || th.offsetWidth;
        document.addEventListener('mousemove', mouseMove);
        document.addEventListener('mouseup', mouseUp);
      });

      // touch support
      resizer.addEventListener('touchstart', (e)=>{
        startX = e.touches[0].clientX;
        col = colgroup.children[index];
        startWidth = parseInt(getComputedStyle(col).width) || th.offsetWidth;
        const touchMove = (ev)=> mouseMove(ev.touches[0]);
        const touchEnd = ()=>{
          document.removeEventListener('touchmove', touchMove);
          document.removeEventListener('touchend', touchEnd);
          const widths = Array.from(colgroup.children).map(c=>c.style.width || getComputedStyle(c).width);
          sessionStorage.setItem(key, JSON.stringify(widths));
        };
        document.addEventListener('touchmove', touchMove);
        document.addEventListener('touchend', touchEnd);
      });
    });
  }
  // Small debounce helper
  function debounce(fn, wait){
    let t;
    return function(){
      clearTimeout(t);
      const args = arguments;
      t = setTimeout(()=>fn.apply(this, args), wait);
    };
  }

  // expose helper with watch support
  window.__colResize = {
    init: function(selector){
      const table = (typeof selector === 'string') ? document.querySelector(selector) : selector;
      if(!table) return;
      init(table);
    },
    watch: function(selectorOrElement, dataTable){
      const table = (typeof selectorOrElement === 'string') ? document.querySelector(selectorOrElement) : selectorOrElement;
      if(!table) return;

      // initialize immediately
      init(table);

      // If a DataTable instance is provided, bind to its events
      if(dataTable && typeof dataTable.on === 'function'){
        // Avoid double-binding
        if(table._colResizeDTBound) return;
        const reinit = debounce(()=>init(table), 50);
        try { dataTable.on('column-visibility.dt', reinit); } catch(e){}
        try { dataTable.on('column-reorder', reinit); } catch(e){}
        try { dataTable.on('column-reorder.dt', reinit); } catch(e){}
        try { dataTable.on('draw.dt', reinit); } catch(e){}
        table._colResizeDTBound = true;
        return;
      }

      // Fallback: observe header mutations
      if(table._colResizeObserver) return;
      const thead = table.querySelector('thead');
      if(!thead) return;
      const observer = new MutationObserver(debounce(()=>{ init(table); }, 80));
      observer.observe(thead, { childList: true, subtree: true, attributes: true });
      table._colResizeObserver = observer;
    }
    ,
    reset: function(selectorOrElement){
      const table = (typeof selectorOrElement === 'string') ? document.querySelector(selectorOrElement) : selectorOrElement;
      if(!table) return;
      const key = 'colWidths:' + (table.id || table.getAttribute('data-table-key') || window.location.pathname);
      const initKey = 'colInitWidths:' + (table.id || table.getAttribute('data-table-key') || window.location.pathname);
      const colgroup = table.querySelector('colgroup');
      const initial = sessionStorage.getItem(initKey);
      if(initial && colgroup){
        const arr = JSON.parse(initial);
        arr.forEach((w,i)=>{ if(colgroup.children[i]) colgroup.children[i].style.width = w; });
      }
      sessionStorage.removeItem(key);
    }
  };
})();