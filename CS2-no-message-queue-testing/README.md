# Queue Based Load Leveling
Dưới đây là một chương trình có nhiệm vụ chuyển file ảnh tiếng Anh sang một file `pdf` tiếng Việt. Các bước xử lý lần lượt bao gồm: chuyển đổi ảnh sang text, dịch tiếng Anh sang tiếng Việt, chuyển đổi nội dung text thành file `pdf`. Chương trình chính chỉ demo các tính năng này tuần tự.

## Hướng dẫn cài đặt
```sh
# Cài đặt các gói liên quan
$ npm install
# Cài đặt RabbitMQ: 
$ Chạy RabbitMQ trên localhost với user: guest, password: guest
# Lưu ý: Phải CS2-queue-based-load-leveling trước khi chạy
# Chạy producer: uploader.js
$ node src/producer/image-uploader/uploader.js
# Chạy 2-3 instances consumer: translate-consumer.js
$ node src/consumer/translate-consumer/translate-consumer.js
# Upload nhiều ảnh thông qua curl (tối đa 1000 ảnh): 
$ curl -X POST http://localhost:3000/upload/batch \
  -F "images=@src/producer/uploads/i-1.png" \
  -F "images=@src/producer/uploads/i-3.png"
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