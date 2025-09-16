const BASE64 = { width: 0, height: 0 };
const crypto = require("crypto");

const getHash = (data) => {
  try {
    const hash = crypto.createHash("sha256");
    hash.update(data);
    return hash.digest("hex");
  } catch (error) {
    console.error("Error while calculating hash:", error);
  }
};

exports.install = function () {
  F.route("/api/login/", json_exec, ["*Login", "post", "unauthorize"]);

  F.group(["authorize"], function () {
    // Common
    F.route("/logoff/", logoff);

    // Uploads
    F.route("/api/upload/", upload, ["upload", 10000], 524288); // 3 MB
    F.route("/api/upload/photo/", upload_photo, ["upload", 10000], 1024); // 1 MB
    F.route("/api/upload/base64/", upload_base64, ["post", 10000], 2048); // 2 MB

    // Users
    F.route("/api/account/", json_save, ["*Account", "post"]);

    // Channels (SA)
    F.route("/api/channels/{id}/", json_read, ["*Channel"]);
    F.route("/api/channels/", json_save, ["*Channel", "post"]);
    F.route("/api/channels/{id}/", json_remove, ["*Channel", "delete"]);
    F.route("/api/blacklist/", json_blacklist, ["post"]);

    // Messages
    //F.route('/api/messages/{id}/',  json_read,     ['*Message']);
    //F.route('/api/messages/{id}/',  json_query,    ['*Message']);
    F.route("/api/files/{id}/", json_files, ["*Message"]);
    F.route("/api/message/{id}/", json_message, ["*Message"]);
    //F.route('/api/messages/{conversation_id}/{id}',  json_read,   ['*Message']);
    F.route("/api/messages/{conversation_id}/", json_query, ["*Message"]);
    F.route("/api/messages/{conversation_id}/{id}/", json_remove, [
      "*Message",
      "delete",
    ]);

    // Favorites
    F.route("/api/favorites/", json_query, ["*Favorite"]);
    F.route("/api/favorites/", json_save, ["*Favorite", "post"]);
    F.route("/api/favorites/{id}/", json_remove, ["*Favorite", "delete"]);

    // Tasks
    F.route("/api/tasks/", json_query, ["*Task"]);
    F.route("/api/tasks/", json_save, ["*Task", "post"]);
    F.route("/api/tasks/{id}/", json_exec, ["*Task"]);

    // Users (SA)
    F.route("/api/users/", json_query, ["*User"]);
    F.route("/api/users/", json_save, ["*User", "post"]);
    F.route("/api/users/{id}/", json_read, ["*User"]);
    F.route("/api/users/{id}/", json_remove, ["*User", "delete"]);
  });

  F.file("/download/", file_read);
};

function file_read(req, res) {

  //console.log("req" + req);
  var id = req.split[1].replace("." + req.extension, "");
  res.noCompress = true;

  F.exists(req, res, function (next, filename) {
    NOSQL("files").counter.hit("read");
    NOSQL("files").binary.read(id, function (err, stream, header) {
      if (err) {
        next();
        return res.throw404();
      }

      var writer = require("fs").createWriteStream(filename);

      CLEANUP(writer, function () {
        res.file(
          filename,
          req.extension === "js" ||
            req.extension === "css" ||
            req.extension === "jpg" ||
            req.extension === "jpeg" ||
            req.extension === "png" ||
            req.extension === "gif"
            ? undefined
            : header.name
        );
        next();
      });

      stream.pipe(writer);
    });
  });
}

// function upload() {
//   var self = this;
//   var id = [];

//   self.files.wait(
//     function (file, next) {
//       file.read(function (err, data) {

//         var fileType = "";
//         if (file.type.includes("image")) {
//           fileType = "image";
//         }

//         // Store current file into the HDD
//         file.extension = U.getExtension(file.filename);
//         var filename =
//           NOSQL("files").binary.insert(file.filename, data) + (file.extension ? "." + file.extension : "");
//         //"." + file.extension;

//         id.push({
//           url: "/download/" + filename,
//           filename: file.filename,
//           width: file.width,
//           height: file.height,
//           type: fileType,
//           checksum: getHash(data),
//         });

//         NOSQL("files").counter.hit("write");

//         // Next file
//         setTimeout(next, 100);
//       });
//     },
//     () => self.json(id)
//   );
// }

function upload() {
  var self = this;
  var id = [];

  
  self.files.wait(
    function (file, next) {

      file.read(function (err, data) {
        if (err) {
          console.error('Error reading file:', file.filename, err);
          return next(); // Переходим к следующему файлу
        }

        // Проверяем, что данные получены полностью
        if (!data || data.length !== file.size) {
          console.error('Incomplete file data:', file.filename,
            'Expected:', file.size, 'Received:', data?.length);
          return next();
        }

        var fileType = "";
        if (file.type.includes("image")) {
          fileType = "image";
        }

        try {
          // Проверяем целостность изображения (для картинок)
          if (fileType === "image" && !isValidImage(data)) {
            console.error('Invalid image data:', file.filename);
            return next();
          }

          file.extension = U.getExtension(file.filename);
          var filename = NOSQL("files").binary.insert(file.filename, data) +
            (file.extension ? "." + file.extension : "");

          id.push({
            url: "/download/" + filename,
            filename: file.filename,
            width: file.width,
            height: file.height,
            type: fileType,
            checksum: getHash(data),
            size: data.length // Добавляем реальный размер полученных данных
          });

          NOSQL("files").counter.hit("write");

        } catch (e) {
          console.error('Error processing file:', file.filename, e);
        }

        // Убираем setTimeout - он может создавать проблемы
        next();
      });
    },
    () => self.json(id)
  );
}

// Дополнительная функция для проверки целостности изображения
function isValidImage(buffer) {
  try {
    // Простая проверка: первые байты должны соответствовать формату изображения
    const signatures = {
      'jpg': [0xFF, 0xD8, 0xFF],
      'png': [0x89, 0x50, 0x4E, 0x47],
      'gif': [0x47, 0x49, 0x46, 0x38]
    };

    for (const [type, sig] of Object.entries(signatures)) {
      if (sig.every((byte, i) => buffer[i] === byte)) {
        return true;
      }
    }
    return false;
  } catch (e) {
    return false;
  }
}


function upload_base64() {
  var self = this;

  if (!self.body.file) {
    self.json({ error: "No file provided" });
    return;
  }

  // Проверяем, является ли данные base64 строкой
  if (typeof self.body.file !== 'string' || !self.body.file.includes('base64')) {
    self.json({ error: "Invalid base64 data" });
    return;
  }

  try {
    // Извлекаем MIME type из base64 строки
    const matches = self.body.file.match(/^data:([A-Za-z-+\/]+);base64,/);
    if (!matches || matches.length !== 2) {
      self.json({ error: "Invalid base64 format" });
      return;
    }

    const mimeType = matches[1];
    let ext;
    
    switch (mimeType) {
      case "image/png":
        ext = ".png";
        break;
      case "image/jpeg":
        ext = ".jpg";
        break;
      case "image/gif":
        ext = ".gif";
        break;
      case "image/webp":
        ext = ".webp";
        break;
      case "image/svg+xml":
        ext = ".svg";
        break;
      case "image/bmp":
        ext = ".bmp";
        break;
      case "image/x-icon":
        ext = ".ico";
        break;
      default:
        self.json({ error: "Unsupported image type: " + mimeType });
        return;
    }

    // Удаляем префикс data URL
    const base64Data = self.body.file.replace(/^data:image\/\w+;base64,/, '');
    const data = Buffer.from(base64Data, 'base64');
    
    // Проверяем валидность изображения
    if (!isValidImage(data)) {
      self.json({ error: "Invalid image data" });
      return;
    }

    const filename = "screenshot_" + Date.now() + ext;
    const fileId = NOSQL("files").binary.insert(filename, data);
    
    const result = {
      url: "/download/" + fileId + ext,
      filename: filename,
      type: "image",
      checksum: getHash(data),
      size: data.length
    };

    NOSQL("files").counter.hit("write");
    self.json(result);

  } catch (error) {
    console.error("Error processing base64 upload:", error);
    self.json({ error: "Server error processing image" });
  }
}

function upload_photo() {
  var self = this;
  var file = self.files[0];

  if (file.isImage()) {
    var id = Date.now().toString();
    file.image().make(function (builder) {
      builder.resizeAlign(150, 150, "center");
      builder.quality(95);
      builder.save(F.path.public("/photos/{0}.jpg".format(id)), () =>
        self.json(id)
      );
    });
  } else self.invalid().push("error-user-photo");
}

function json_query(id) {
  this.id = id;
  this.$query(this.callback());
}

function json_read(id) {
  this.id = id;
  this.$read(this.callback());
}

function json_save(id) {
  this.id = id;
  this.$save(this.callback());
}

function json_remove(id) {
  this.id = id;
  this.$remove(this.callback());
}

function json_exec(id) {
  this.id = id;
  this.$workflow("exec", this.callback());
}

function json_files(id) {
  this.id = id;
  this.$workflow("files", this.callback());
}

function json_message(id) {
  this.id = id;
  this.$workflow("message", this.callback());
}

function json_blacklist() {
  var self = this;
  if (self.body instanceof Array) {
    self.user.blacklist = {};
    for (var i = 0, length = self.body.length; i < length; i++) {
      var id = self.body[i];
      if (id.isUID()) {
        self.user.blacklist[id] = true;
        self.user.unread[id] && delete self.user.unread[id];
      }
    }
    OPERATION("users.save", NOOP);
  }
  self.json(SUCCESS(true));
}

function logoff() {
  this.cookie(F.config.cookie, "", "-1 day");
  this.redirect("/");
}
