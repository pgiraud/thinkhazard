# -*- coding: utf-8 -*-
#
# Copyright (C) 2015-2016 by the GFDRR / World Bank
#
# This file is part of ThinkHazard.
#
# ThinkHazard is free software: you can redistribute it and/or modify it under
# the terms of the GNU General Public License as published by the Free
# Software Foundation, either version 3 of the License, or (at your option)
# any later version.
#
# ThinkHazard is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
# more details.
#
# You should have received a copy of the GNU General Public License along with
# ThinkHazard.  If not, see <http://www.gnu.org/licenses/>.

import logging
import traceback
import os
from datetime import datetime
from urlparse import urlunsplit
from httplib2 import Http
import transaction

from ..models import (
    DBSession,
    Layer,
    )

from . import settings, layer_path


logger = logging.getLogger(__name__)
geonode = settings['geonode']


def clearall():
    logger.info('Reset all layer to not downloaded state.')
    DBSession.query(Layer).update({
        Layer.downloaded: False
    })
    DBSession.flush()


def download(hazardset_id=None, force=False, dry_run=False):
    if force:
        try:
            clearall()
            if dry_run:
                transaction.abort()
            else:
                transaction.commit()
        except:
            transaction.abort()
            raise

    geonode_ids = DBSession.query(Layer.geonode_id)

    if not force:
        geonode_ids = geonode_ids.filter(Layer.downloaded.is_(False))

    if hazardset_id is not None:
        geonode_ids = geonode_ids.filter(Layer.hazardset_id == hazardset_id)

    for geonode_id in geonode_ids:
        try:
            download_layer(geonode_id)
            if dry_run:
                transaction.abort()
            else:
                transaction.commit()
        except Exception:
            transaction.abort()
            logger.error(traceback.format_exc())


def download_layer(geonode_id):
    layer = DBSession.query(Layer).get(geonode_id)
    if layer is None:
        raise Exception('Layer {} does not exist.'.format(geonode_id))

    logger.info('Downloading layer {}'.format(layer.name()))

    path = layer_path(layer)

    dir_path = os.path.dirname(path)
    if not os.path.exists(dir_path):
        os.makedirs(dir_path)

    # If file is obsolete, unlink
    if os.path.isfile(path):
        cache_mtime = datetime.fromtimestamp(os.path.getmtime(path))
        if layer.data_lastupdated_date > cache_mtime:
            logger.debug('  File {} considered as obsolete {} > {}'
                         .format(layer.filename(),
                                 layer.data_lastupdated_date,
                                 cache_mtime))
            os.unlink(path)
        else:
            logger.info('  File {} found in cache'.format(layer.filename()))

    # If file not in cache, download it
    if not os.path.isfile(path):
        h = Http()
        url = urlunsplit((geonode['scheme'],
                          geonode['netloc'],
                          layer.download_url,
                          '',
                          ''))
        logger.info('  Retrieving {}'.format(url))
        response, content = h.request(url)

        logger.info('  Saving to {}'.format(path))
        try:
            with open(path, 'wb') as f:
                f.write(content)
        except EnvironmentError:
            logger.error('  Writing data from layer {} failed'.format(
                layer.name()))
            logger.error(traceback.format_exc())

    layer.downloaded = os.path.isfile(path)

    DBSession.flush()
