NEWSCHEMA('Message').make(function(schema) {

	schema.setQuery(function(error, options, callback, controller) {

		var id;

		if (controller.id.startsWith('user')) {
			id = controller.id.substring(4);
			controller.id = 'user' + F.global.merge(id, controller.user.id);
		} else
			id = controller.id.substring(7);

		if (controller.id[0] === 'c' && controller.user.channels && !controller.user.channels[id]) {
			error.push('error-user-privileges');
			return callback();
		}

		controller.user.unread[id] && (delete controller.user.unread[id]);

		if (controller.query.q) {
			NOSQL(controller.id + '-backup').find().search('search', controller.query.q.keywords(true, true)).page((controller.query.page || 1) - 1, controller.query.max || 15).callback(function(err, response) {
				var output = SINGLETON('messages.query');
				output.items = response;
				output.stats = undefined;
				callback(output);
			});
			return;
		}

		var db = NOSQL(controller.id);
		var count = db.meta('likes');

		if (!controller.query.max)
			controller.query.max = 15;

		var filter = db.find();
		filter.or();
		filter.where('dateexpired', undefined);
		filter.where('dateexpired', '>', F.datetime);
		filter.end();
		filter.sort('datecreated', true);
		filter.page((controller.query.page || 1) - 1, controller.query.max + count);
		filter.callback(function(err, response) {
			response.forEach(message => {
				//console.log(message.body + ": " + message.idowner);
				//console.log(message);
				//console.log(controller.user.id);
				// if(message.idowner === controller.user.id){
				// 	NOSQL(controller.id).modify({unread: false}).where('id', message.id);
				// }
				if(message.iduser !== controller.user.id){
					NOSQL(controller.id).modify({unread: false}).where('id', message.id);
				}
			});
			
			// Sets the first message as read message
			if (controller.query.page === 1 && id && response.length){
				controller.user.lastmessages[id] = response[0].id;
				//console.log(controller)
				// controller.channel
				// console.log(controller.user.messages);
			}
				

			db.counter.monthly('all', function(err, counter) {
				var output = SINGLETON('messages.query');
				output.items = response;
				output.stats = counter;
				callback(output);
			});
		});
	});

	schema.addWorkflow('files', function(error, model, options, callback, controller) {

		var id;

		if (controller.id.startsWith('user')) {
			id = controller.id.substring(4);
			controller.id = 'user' + F.global.merge(id, controller.user.id);
		} else
			id = controller.id.substring(7);

		// channel
		if (controller.id[0] === 'c' && controller.user.channels && !controller.user.channels[id]) {
			error.push('error-user-privileges');
			return callback();
		}

		NOSQL(controller.id + '-files').find().page((controller.query.page || 1) - 1, controller.query.max || 15).sort('datecreated', true).callback(callback);
	});

	schema.setRemove(function(error, options, callback, controller) {
		function stringify(obj) {
			let cache = [];
			let str = JSON.stringify(obj, function(key, value) {
			  if (typeof value === "object" && value !== null) {
				if (cache.indexOf(value) !== -1) {
				  // Circular reference found, discard key
				  return;
				}
				// Store value in our collection
				cache.push(value);
			  }
			  return value;
			});
			cache = null; // reset the cache
			return str;
		  }

		if (controller.id.startsWith('user')) {
			id = controller.id.substring(4);
			controller.id = 'user' + F.global.merge(id, controller.user.id);
		}
		console.log("------------------NOSQL---------------");

		console.log(controller.req.path);
		NOSQL(controller.id).remove().where('id', controller.req.path[controller.req.path.length - 1]);
		OPERATION('messages.cleaner', controller.id, NOOP)
		callback(SUCCESS(true));
	});
});