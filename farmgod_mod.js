ScriptAPI.register('FarmGod_Mod_Fixed_Final', true, 'Warre', 'nl.tribalwars@coma.innogames.de');
window.FarmGod = {};
window.FarmGod.Library = (function () {
  if (typeof window.twLib === 'undefined') {
    window.twLib = {
      queues: null,
      init: function () { if (this.queues === null) { this.queues = this.queueLib.createQueues(5); } },
      queueLib: {
        maxAttempts: 3,
        Item: function (action, arg, promise = null) { this.action = action; this.arguments = arg; this.promise = promise; this.attempts = 0; },
        Queue: function () {
          this.list = []; this.working = false; this.length = 0;
          this.doNext = function () {
            let item = this.dequeue(); let self = this;
            if (item.action == 'openWindow') {
              window.open(...item.arguments).addEventListener('DOMContentLoaded', function () { self.start(); });
            } else {
              $[item.action](...item.arguments)
                .done(function () { item.promise.resolve.apply(null, arguments); self.start(); })
                .fail(function () {
                  item.attempts += 1;
                  if (item.attempts < twLib.queueLib.maxAttempts) { self.enqueue(item, true); } 
                  else { item.promise.reject.apply(null, arguments); }
                  self.start();
                });
            }
          };
          this.start = function () { if (this.length) { this.working = true; this.doNext(); } else { this.working = false; } };
          this.dequeue = function () { this.length -= 1; return this.list.shift(); };
          this.enqueue = function (item, front = false) { front ? this.list.unshift(item) : this.list.push(item); this.length += 1; if (!this.working) { this.start(); } };
        },
        createQueues: function (amount) { let arr = []; for (let i = 0; i < amount; i++) { arr[i] = new twLib.queueLib.Queue(); } return arr; },
        addItem: function (item) {
          let leastBusyQueue = twLib.queues.map((q) => q.length).reduce((next, curr) => (curr < next ? curr : next), 0);
          twLib.queues[leastBusyQueue].enqueue(item);
        },
        orchestrator: function (type, arg) { let promise = $.Deferred(); let item = new twLib.queueLib.Item(type, arg, promise); twLib.queueLib.addItem(item); return promise; },
      },
      ajax: function () { return twLib.queueLib.orchestrator('ajax', arguments); },
      get: function () { return twLib.queueLib.orchestrator('get', arguments); },
      post: function () { return twLib.queueLib.orchestrator('post', arguments); },
      openWindow: function () { let item = new twLib.queueLib.Item('openWindow', arguments); twLib.queueLib.addItem(item); },
    };
    twLib.init();
  }
  const setUnitSpeeds = function () {
    let unitSpeeds = {};
    $.when($.get('/interface.php?func=get_unit_info')).then((xml) => {
      $(xml).find('config').children().map((i, el) => { unitSpeeds[$(el).prop('nodeName')] = $(el).find('speed').text().toNumber(); });
      localStorage.setItem('FarmGod_unitSpeeds', JSON.stringify(unitSpeeds));
    });
  };
  const getUnitSpeeds = function () { return JSON.parse(localStorage.getItem('FarmGod_unitSpeeds')) || false; };
  if (!getUnitSpeeds()) setUnitSpeeds();
  const determineNextPage = function (page, $html) {
    let villageLength = $html.find('#scavenge_mass_screen').length > 0 ? $html.find('tr[id*="scavenge_village"]').length : $html.find('tr.row_a, tr.row_ax, tr.row_b, tr.row_bx').length;
    let navSelect = $html.find('.paged-nav-item').first().closest('td').find('select').first();
    let navLength = $html.find('#am_widget_Farm').length > 0 ? parseInt($('#plunder_list_nav').first().find('a.paged-nav-item, strong.paged-nav-item')[$('#plunder_list_nav').first().find('a.paged-nav-item, strong.paged-nav-item').length - 1].textContent.
