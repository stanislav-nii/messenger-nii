NEWSCHEMA('Channel').make(function(schema) {

	schema.define('id', 'UID');
	schema.define('name', 'String(100)', true);
	schema.define('description', 'String(200)', true);
	schema.define('unread', Boolean);

	schema.setGet(function(error, model, options, callback, controller) {

		// if (!controller.user.sa) {
		// 	error.push('error-user-privileges');
		// 	return callback();
		// }

		var item = F.global.channels.findItem('id', controller.id);
		!item && error.push('error-channel-404');
		callback(item);
	});

	schema.setSave(function(error, model, options, callback, controller) {
		if (!controller.user.sa) {
			error.push('error-user-privileges');
			return callback();
		}

		var tmp = model.$clean();

		tmp.linker = model.name.slug();
		!tmp.linker && (tmp.linker = U.GUID(10));
		if (tmp.id) {
			var item = F.global.channels.findItem('id', tmp.id);
			if (!item) {
				error.push('error-channel-404');
				return callback();
			}

			item.name = tmp.name;
			item.linker = tmp.linker;
			item.description = tmp.description;
			item.unread = true;
		} else {
			if(F.global.channels.findItem('linker', tmp.linker)){
				error.push('error-channel-name');
				return callback();
			}
			tmp.datecreated = F.datetime;
			tmp.id = UID();
			F.global.channels.push(tmp);
		}

		F.global.channels.quicksort('name');
		F.global.refresh && F.global.refresh();
		OPERATION('channels.save', NOOP);
		callback(SUCCESS(true));
	});

	schema.setRemove(function(error, options, callback, controller) {

		if (!controller.user.sa) {
			error.push('error-user-privileges');
			return callback();
		}

		F.global.channels = F.global.channels.remove('id', controller.id);
		F.global.refresh && F.global.refresh();

		F.global.users.forEach(function(item) {
			if (item.unread[controller.id])
				delete item.unread[controller.id];
			if (item.channels && item.channels[controller.id])
				delete item.channels[controller.id];
			if (item.lastmessages && item.lastmessages[controller.id])
				delete item.lastmessages[controller.id];
		});

		NOSQL('channel' + controller.id).drop();
		OPERATION('channels.save', NOOP);
		callback(SUCCESS(true));
	});
});