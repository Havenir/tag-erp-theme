// import DesktopTest from "./components/DesktopTest.vue";
import Home from "./components/Home.vue"

frappe.views.pageview.show =  function(name) {
  if(!name) {
    name = (frappe.boot ? frappe.boot.home_page : window.page_name);

    if(name === "desktop") {
      if(!frappe.pages.desktop) {
        let page = frappe.container.add_page('desktop');
        let container = $('<div class="container custom-main-container"></div>').appendTo(page);
        container = $('<div></div>').appendTo(container);

        new Vue({
          el: container[0],
          render: h => h(Home)
        });
      }

      frappe.container.change_to('desktop');
      frappe.utils.set_title(__('Home'));
      return;
    }
  }
  frappe.model.with_doctype("Page", function() {
    frappe.views.pageview.with_page(name, function(r) {
      if(r && r.exc) {
        if(!r['403'])
          frappe.show_not_found(name);
      } else if(!frappe.pages[name]) {
        new frappe.views.Page(name);
      }
      frappe.container.change_to(name);
    });
  });
}