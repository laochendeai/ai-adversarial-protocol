#!/bin/bash
for h in docker.1ms.run docker.1panel.live atomhub.openatom.cn dockerhub.icu mirror.iscas.ac.cn docker.nju.edu.cn registry.dockermirror.com; do
  printf "%-32s " "$h"
  timeout 8 curl -sSI -m 8 "https://$h/v2/" 2>&1 | head -1
done
