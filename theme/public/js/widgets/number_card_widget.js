frappe.widget.widget_factory.number_card.prototype.make = function(){
	this.make_widget();
	this.widget.appendTo(this.container);
	this.widget.parents('.widget-group').addClass('number-card-widget');
}