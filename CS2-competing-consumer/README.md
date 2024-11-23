# Competing Consumer
Dưới đây là một chương trình có nhiệm vụ chuyển file ảnh tiếng Anh sang một file `pdf` tiếng Việt. Các bước xử lý lần lượt bao gồm: chuyển đổi ảnh sang text, dịch tiếng Anh sang tiếng Việt, chuyển đổi nội dung text thành file `pdf`. Chương trình chính chỉ demo các tính năng này tuần tự.

## Hướng dẫn cài đặt
```sh
# Cài đặt các gói liên quan
$ npm install
# Cài đặt RabbitMQ: 
$ Chạy RabbitMQ trên localhost với user: guest, password: guest
# Lưu ý: Phải cd CS2-competing-consumer trước khi chạy
# Chạy producer: uploader.js
$ cd CS2-competing-consumer 
$ node src/producer/image-uploader/uploader.js
# Chạy 2-3 instances consumer: translate-consumer.js
$ node src/consumer/translate-consumer/translate-consumer.js (chạy ở 2 terminal khác nhau)
# Upload nhièu instance ảnh thông qua curl (mở 1 terminal khác) - với x là số lần bạn muốn ảnh dó được gửi 
$  curl -X POST "http://localhost:3000/upload?repeat=X" -F "image=@src/producer/uploads/i-2.png"
```
## Mô Tả

| Producer | Chức năng |
|--|:--|
| uploader| upload message chứa thông tin gồm: filename, filepath cho Rabbit|

| Consumer | Chức năng |
|--|:--|
| translate-consumer| nhận message từ RabbitMQ -> thực hiện quá trình dịch và convert ảnh -> pdf|

| Services | Chức năng |
|--|:--|
| services/ocr.js | Chuyển đổi ảnh sang text |
| services/translate.js | Dịch tiếng Anh sang tiếng Việt |
| services/pdf.js | Chuyển đổi text sang PDF |