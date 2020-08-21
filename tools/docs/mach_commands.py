# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, # You can obtain one at http://mozilla.org/MPL/2.0/.

from __future__ import unicode_literals

import os

from mach.decorators import (
    CommandArgument,
    CommandProvider,
    Command,
)

from mozbuild.base import MachCommandBase
from mozbuild.frontend.reader import BuildReader


@CommandProvider
class Documentation(MachCommandBase):
    """Helps manage in-tree documentation."""

    @Command('build-docs', category='build-dev',
        description='Generate documentation for the tree.')
    @CommandArgument('--format', default='html',
        help='Documentation format to write.')
    @CommandArgument('outdir', default='<DEFAULT>', nargs='?',
        help='Where to write output.')
    def build_docs(self, format=None, outdir=None):
        self._activate_virtualenv()
        self.virtualenv_manager.install_pip_package('mdn-sphinx-theme==0.4')

        from moztreedocs import SphinxManager

        if outdir == '<DEFAULT>':
            outdir = os.path.join(self.topobjdir, 'docs')

        manager = SphinxManager(self.topsrcdir, os.path.join(self.topsrcdir,
            'tools', 'docs'), outdir)

        # We don't care about GYP projects, so don't process them. This makes
        # scanning faster and may even prevent an exception.
        def remove_gyp_dirs(sandbox):
            sandbox['GYP_DIRS'][:] = []

        reader = BuildReader(self.config_environment,
            sandbox_post_eval_cb=remove_gyp_dirs)

        for sandbox in reader.walk_topsrcdir():
            for dest_dir, source_dir in sandbox['SPHINX_TREES'].items():
                manager.add_tree(os.path.join(sandbox['RELATIVEDIR'],
                    source_dir), dest_dir)

            for entry in sandbox['SPHINX_PYTHON_PACKAGE_DIRS']:
                manager.add_python_package_dir(os.path.join(sandbox['RELATIVEDIR'],
                    entry))

        return manager.generate_docs(format)
