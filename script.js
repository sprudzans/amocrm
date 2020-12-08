define(['jquery', 'twigjs', 'https://cdnjs.cloudflare.com/ajax/libs/js-sha256/0.9.0/sha256.min.js'], function ($, Twig, lib) {
    let CustomWidget = function () {
        let self = this,
            system = self.system;

        self.get_lcard_info = function () {
            return {
                "name": $('.TinkoffPayForm input[name=name]').val(),
                "description": $('.TinkoffPayForm input[name=description]').val(),
                "order": $('.TinkoffPayForm input[name=id]').val(),
                "phone": $('.TinkoffPayForm input[name=phone]').val(),
                "email": $('.TinkoffPayForm input[name=email]').val(),
                "amount": $('.TinkoffPayForm input[name=amount]').val(),
                "tax": $('.TinkoffPayForm select[name=tax]').val(),
            };
        };

        self.get_receipt = function (payment_data) {
            if(self.get_settings().receipt == "Да"){
                return {
                    "Email": payment_data['email'],
                    "Phone": payment_data['phone'],
                    "EmailCompany": self.get_settings().email,
                    "Taxation": self.get_settings().taxation ? self.get_settings().taxation : "osn",
                    "Items": [
                        {
                            "Name": payment_data['name'] ? payment_data['name'] : "Оплата",
                            "Price": payment_data['amount'] + "00",
                            "Quantity": 1.00,
                            "Amount": payment_data['amount'] + "00",
                            "Tax": payment_data['tax'],
                        }
                    ]
                }
            } else {return false;}
        }

        self.get_random_int = function () {
            return Math.floor(Math.random() * Math.floor(1000000));
        };

        self.sendInfo = function (payment_data, items) {
            let receipt = {
                "TerminalKey": self.get_settings().terminal,
                "Amount": payment_data['amount'].toString() + "00",
                "OrderId": payment_data['order'],
                "Description": payment_data['description']
            }

            if(items){
                receipt.Receipt = items
            }

            fetch('https://securepay.tinkoff.ru/v2/Init', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(receipt)
            })
                .then(response => response.json())
                .then((obj) => {
                    if(obj.PaymentURL){
                        $('div.payment_link').html(`<a href="${obj.PaymentURL}" target="_blank">Ссылка на форму оплаты</a>`)
                        $('.control-contenteditable__area').html(`Ссылка на форму оплаты - ${obj.PaymentURL} / Идентификатор платежа ${obj.PaymentId}`)
                    } else {$('.control-contenteditable__area').html(obj.Details)}
                })
        };

        self.getState = function (PaymentId) {
            let request = {
                "TerminalKey": self.get_settings().terminal,
                "PaymentId": PaymentId,
                "Token": sha256(self.get_settings().password + PaymentId + self.get_settings().terminal)
            }


            fetch("https://securepay.tinkoff.ru/v2/GetState", {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(request)
            })
                .then(response => response.json())
                .then((obj) => {
                    if (obj.Status == "CONFIRMED") {
                        $('div.state_response').html(`<p style="padding: 5px 0;text-align: center;">Оплачен</p>`)
                    } else {
                        $('div.state_response').html(`<p style="padding: 5px 0;text-align: center;">Статус: ${obj.Status}</p>`)
                    }
                })
        }

        self.getTemplate = function (params) {
            let template = '<div class="TinkoffPayForm">\n' +
                '    <label>Название заказа <input type="text" name="name" value="{{ param.name }}"></label>\n' +
                '    <label>Описание заказа <input type="text" name="description" value=""></label>\n' +
                '    <label>Уникальный номер заказа <input type="text" name="id" value="{{ param.id }}"></label>\n' +
                '    <label>Номер телефона <input type="text" name="phone" value="{{ param.phone }}"></label>\n' +
                '    <label>Почтовый адрес <input type="text" name="email" value="{{ param.email }}"></label>\n' +
                '    <label>Ставка НДС <select name="tax">\n' +
                '    <option value="none" selected>без НДС</option>\n' +
                '    <option value="vat0">0%</option>\n' +
                '    <option value="vat10">10%</option>\n' +
                '    <option value="vat20">20%</option>\n' +
                '    <option value="vat110">10/110</option>\n' +
                '    <option value="vat120">20/120</option>\n' +
                '    </select>\n' +
                '    </label>\n' +
                '    <label>Сумма оплаты <input type="text" name="amount" value="{{ param.amount }}"></label>\n' +
                '    <button name="payment">Получить ссылку на форму оплаты</button>\n' +
                '    <div class="payment_link"></div>\n' +
                '    <p style="padding: 15px 0;">Или вы можете узнать статус оплаты, указав идентификатор платежа</p>\n' +
                '    <label>Идентификатор платежа <input type="text" name="PaymentId" value=""></label>\n' +
                '    <button name="state">Узнать статус оплаты</button>\n' +
                '    <div class="state_response"></div>\n' +
                '    <link rel="stylesheet" href="{{param.path}}/style.css">\n' +
                '</div>'

            return self.render({data: template}, {param: params});
        };

        self.callbacks = {
            settings: function () {
            },
            dpSettings: function () {
            },
            init: function () {
                return true;
            },
            bind_actions: function () {
                if (self.system().area === 'lcard') {
                    $('.TinkoffPayForm button[name=payment]').on('click', function () {
                        let data = self.get_lcard_info();
                        self.sendInfo(data,  self.get_receipt(data));
                    });
                    $('.TinkoffPayForm button[name=state]').on('click', function () {
                        self.getState($('.TinkoffPayForm input[name=PaymentId]').val());
                    });
                }
                return true;
            },
            render: function () {
                let lang = self.i18n('userLang');
                if (self.system().area === 'lcard') {
                    let render_data = self.getTemplate (
                        {
                            id: self.get_random_int().toString(),
                            name: AMOCRM.constant("card_element").name,
                            phone: $("input[data-type=phone]").val(),
                            email: $("input[data-type=email]").val(),
                            amount: AMOCRM.constant("card_element").raw_price,
                            path: self.params.path
                        });
                    self.render_template(
                        {
                            caption: {
                                class_name: 'js-tinkoff-form'
                            },
                            body: '',
                            render: render_data
                        },
                        {
                            name: "Модуль приема платежей Тинькофф Банк",
                            w_code: self.get_settings().widget_code,
                            b_name: "lang"
                        }
                    );
                }
                return true;
            },
            onSave: function () {
                return true;
            }
        };
        return this;
    };
    return CustomWidget;
});