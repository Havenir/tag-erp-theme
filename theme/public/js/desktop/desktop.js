export default class Desktop {
	constructor({ wrapper }) {
		this.wrapper = wrapper;
		this.pages = {};
		this.sidebar_items = {};
		this.sidebar_categories = [
			"Modules",
			"Domains",
			"Places",
			"Administration"
		];
		this.make();
	}

	make() {
		this.make_container();
		this.fetch_desktop_settings().then(() => {
			this.route();
			this.make_sidebar();
		});
	}

	route() {
		let page = this.get_page_to_show();
		this.show_page(page);
	}

	make_container() {
		this.container = $(`<div class="desk-container row">
				<div class="desk-sidebar custom-desk-sidebar"></div>
				<div class="desk-body custom-desk-body"></div>
			</div>`);

		this.container.appendTo(this.wrapper);
		this.sidebar = this.container.find(".desk-sidebar");
		this.body = this.container.find(".desk-body");
	}

	fetch_desktop_settings() {
		return frappe
			.call("frappe.desk.desktop.get_desk_sidebar_items")
			.then(response => {
				if (response.message) {
					this.desktop_settings = response.message;
				} else {
					frappe.throw({
						title: __("Couldn't Load Desk"),
						message:
							__("Something went wrong while loading Desk. <b>Please relaod the page</b>. If the problem persists, contact the Administrator"),
						indicator: "red",
						primary_action: {
							label: __("Reload"),
							action: () => location.reload()
						}
					});
				}
			});
	}

	make_sidebar() {
		let allowed_modules = frappe.boot.allowed_modules;
		if(allowed_modules){
			$(".custom-nav-ul ul.custom-nav").empty();
			allowed_modules.forEach(module => {
				if(module.type === "module"){
					$(".custom-nav-ul ul.custom-nav").append(`
					<li>
					<a href="#workspace/${module.label}" class="custom-nav-link">
						<span class="icon-Icon-material-monetization-on module-${module.label}-icon"></span><br>
						${module.label}
					</a>
				</li>
					`)
				}
			});
		}
	}

	show_page(page) {
		if (this.current_page && this.pages[this.current_page]) {
			this.pages[this.current_page].hide();
		}

		if (this.sidebar_items && this.sidebar_items[this.current_page]) {
			this.sidebar_items[this.current_page].removeClass("selected");
			this.sidebar_items[page].addClass("selected");
		}
		this.current_page = page;
		localStorage.current_desk_page = page;
		this.pages[page] ? this.pages[page].show() : this.make_page(page);
	}

	get_page_to_show() {
		const default_page = this.desktop_settings
			? this.desktop_settings["Modules"][0].name
			: "Website";
		let page =
			frappe.get_route()[1] ||
			localStorage.current_desk_page ||
			default_page;
		return page;
	}

	make_page(page) {
		const $page = new DesktopPage({
			container: this.body,
			page_name: page
		});

		this.pages[page] = $page;
		return $page;
	}
}



import ListComponent from '../components/MainList.vue'


class DesktopPage {
	constructor({ container, page_name }) {
		frappe.desk_page = this;
		this.container = container;
		this.page_name = page_name;
		this.sections = {};
		this.allow_customization = false;
		this.reload();
	}

	show() {
		frappe.desk_page = this;
		this.page.show();
		if (this.sections.shortcuts) {
			this.sections.shortcuts.widgets_list.forEach(wid => {
				wid.set_actions();
			});
		}
	}

	hide() {
		this.page.hide();
	}

	reload() {
		this.in_customize_mode = false;
		this.page && this.page.remove();
		this.make();
		this.setup_events();
	}

	make_customization_link() {
		this.customize_link = $(`<div class="small customize-options" style="cursor: pointer;">${__('Customize Workspace')}</div>`);
		this.customize_link.appendTo(this.page);
		this.customize_link.on('click', () => {
			this.customize();
		});

		this.save_or_discard_link = $(`<div class="small customize-options small-bounce">
			<span class="save-customization">${__('Save')}</span> / <span class="discard-customization">${__('Discard')}</span>
			</div>`).hide();

		this.save_or_discard_link.appendTo(this.page);
		this.save_or_discard_link.find(".save-customization").on("click", () => this.save_customization());
		this.save_or_discard_link.find(".discard-customization").on("click", () => this.reload());
		this.page.addClass('allow-customization');
	}

	make_top_row(){
		this.customize_top_text = $(`<h1>${__('')}</h1>`);
		this.customize_top_text.appendTo(this.page);
	}

	make() {
		this.page = $(`<div class="desk-page" data-page-name=${this.page_name}></div>`);
		this.page.appendTo(this.container);

		this.get_data().then(res => {
			this.data = res.message;
			if (!this.data) {
				delete localStorage.current_desk_page;
				frappe.set_route("workspace");
				return;
			}

			this.refresh();
		});
	}

	setup_list_wrapper() {
		this.$frappe_list = $('<div class="frappe-list">').appendTo(this.container);
	}

	list() {
		this.$list_wrapper = this.container.find('.frappe-list');

		new Vue({
			el: this.$list_wrapper[0],
			render: h => h(ListComponent)
		});
	}

	refresh() {
		this.page.empty();
		this.allow_customization = this.data.allow_customization || false;

		if (frappe.is_mobile()) {
			this.allow_customization = false;
		}

		this.allow_customization && this.make_customization_link();
		this.make_top_row();
		this.data.onboarding && this.data.onboarding.items.length && this.make_onboarding();
		this.make_charts().then(() => {
			this.make_shortcuts();
			this.make_cards();

			if (this.allow_customization) {
				// Move the widget group up to align with labels if customization is allowed
				$('.desk-page .widget-group:visible:first').addClass("custom-widget-group")
			}
		});
		this.setup_list_wrapper();
		this.list();
		
	}

	get_data() {
		return frappe.call("frappe.desk.desktop.get_desktop_page", {
			page: this.page_name
		});
	}

	setup_events() {
		$(document.body).on('toggleFullWidth', () => this.refresh());
	}

	customize() {
		if (this.in_customize_mode) {
			return;
		}

		// It may be possible the chart area is hidden since it has no widgets
		// So the margin-top: -25px would be applied to the shortcut group
		// We need to remove this as the  chart group will be visible during customization
		$('.widget.onboarding-widget-box').hide();
		$('.desk-page .widget-group:visible:first').css('margin-top', '0px');

		this.customize_link.hide();
		this.save_or_discard_link.show();

		Object.keys(this.sections).forEach(section => {
			this.sections[section].customize();
		});
		this.in_customize_mode = true;

		// Move the widget group up to align with labels if customization is allowed
		$('.desk-page .widget-group:visible:first').css('margin-top', '-25px');
	}

	save_customization() {
		const config = {};

		if (this.sections.charts) config.charts = this.sections.charts.get_widget_config();
		if (this.sections.shortcuts) config.shortcuts = this.sections.shortcuts.get_widget_config();
		if (this.sections.cards) config.cards = this.sections.cards.get_widget_config();

		frappe.call('frappe.desk.desktop.save_customization', {
			page: this.page_name,
			config: config
		}).then(res => {
			if (res.message) {
				frappe.msgprint({ message: __("Customizations Saved Successfully"), title: __("Success")});
				this.reload();
			} else {
				frappe.throw({message: __("Something went wrong while saving customizations"), title: __("Failed")});
				this.reload();
			}
		});
	}

	make_onboarding() {
		this.onboarding_widget = frappe.widget.make_widget({
			label: this.data.onboarding.label || __(`Let's Get Started`),
			subtitle: this.data.onboarding.subtitle,
			steps: this.data.onboarding.items,
			success: this.data.onboarding.success,
			docs_url: this.data.onboarding.docs_url,
			user_can_dismiss: this.data.onboarding.user_can_dismiss,
			widget_type: 'onboarding',
			container: this.page,
			options: {
				allow_sorting: false,
				allow_create: false,
				allow_delete: false,
				allow_hiding: false,
				allow_edit: false,
				max_widget_count: 2,
			}
		});
	}

	make_charts() {
		return frappe.dashboard_utils.get_dashboard_settings().then(settings => {
			let chart_config = settings.chart_config ? JSON.parse(settings.chart_config): {};
			if (this.data.charts.items) {
				this.data.charts.items.map(chart => {
					chart.chart_settings = chart_config[chart.chart_name] || {};
				});
			}

			this.sections["charts"] = new frappe.widget.WidgetGroup({
				title: this.data.charts.label || __('{} Dashboard', [__(this.page_name)]),
				container: this.page,
				type: "chart",
				columns: 1,
				hidden: Boolean(this.onboarding_widget),
				options: {
					allow_sorting: this.allow_customization,
					allow_create: this.allow_customization,
					allow_delete: this.allow_customization,
					allow_hiding: false,
					allow_edit: true,
					max_widget_count: 2,
				},
				widgets: this.data.charts.items
			});
		});
	}

	make_shortcuts() {
		this.sections["shortcuts"] = new frappe.widget.WidgetGroup({
			title: this.data.shortcuts.label || __('Your Shortcuts'),
			container: this.page,
			type: "shortcut",
			columns: 3,
			options: {
				allow_sorting: this.allow_customization,
				allow_create: this.allow_customization,
				allow_delete: this.allow_customization,
				allow_hiding: false,
				allow_edit: true,
			},
			widgets: this.data.shortcuts.items
		});
	}

	make_cards() {
	}
}
