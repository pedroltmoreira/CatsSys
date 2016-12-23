/*
 * Copyright (C) 2016 Gabriel Pereira <rickardch@gmail.com>
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */


/*
 *  CONSIDERAÇÕES:
 *  As disciplinas estão divididas em três grupos: base subjects, subjects e topics.
 *  * Base subjects: Grandes áreas, disciplinas que não possuem "pais". 
 *      Ex: Ciências da natureza e suas tecnologias
 *  * Subjects: Disciplinas lecionadas. 
 *      Ex: Física 1: Mecânica.
 *  * Topics: Matérias específicas de uma disciplina. As questões são relacionadas
 *      com os topics. 
 *      Ex: Análise dimensional
 * 
 */
define(['jquery', 'datatable', 'datetimepicker'], function () {
    var prepare = (function () {

        /**
         * Cópia do JSON do conteúdo
         * 
         * {
         *       questionsStartAtNumber: <number>,
         *       numberOfQuestions: <number>,
         *       groups: [
         *           {
         *               id: <number>,
         *               groupName: <string>,
         *               subgroups: [
         *                   {
         *                       id: <number>,
         *                       subgroupName: <string>,
         *                       singleColumn: <boolean>,
         *                       numberOfProposedQuestions: <number>,
         *                       questions: [
         *                           {
         *                               id: <number>,
         *                               subjectId: <number>,
         *                               subjectName: <string>
         *                           },
         *                           ...
         *                       ],
         *                   },
         *                   // disciplinas paralelas
         *                   [
         *                       <subject>, 
         *                       ...
         *                   ],
         *                   ...
         *               ]
         *           },
         *           ...
         *       ]
         *   }
         * 
         */
        var contentConfig;        
        
        /*
         * Array de objetos com as questões carregadas por ajax
         * índice = id da questão
         * 
         * Objeto do tipo:
         * 
         *  examQuestions = [
         *      {
         *          enunciation: <string>,
         *          alternatives: [
         *              <string>,
         *              ...
         *          ],
         *          correctAlternative: <number>,
         *          topicId: <number>
         *      },
         *      ...
         *  ];
         * 
         * 
         */
        var examQuestions = [];
        
        /*
         *  Array de objetos com formatação para inserir no DataTable as questões de uma disciplina 
         *  índice = id da disciplina
         *  
         *  sQuestionsDatatable = [
         *      {
         *          DT_RowClass: <string>,
         *          DT_RowAttr: {
         *              "id": <string>,
         *              "data-id": <number, string>
         *          },
         *          0: <string>
         *      },
         *      ...
         *  ]
         * 
         */
        var sQuestionsDatatable = [];
                
        /*
         *  Array de bool com as questões selecionadas (adicionadas ao conteúdo)
         *  índice = id da questão
         *  
         *  selectedQuestions = [
         *      <bool>,
         *      ...  
         *  ]
         * 
         */
        var selectedQuestions = [];
        
        
        //  Número de questões adicionadas
        var questionCount = 0;
        
        //  id do DataTable
        var questionTable = $('#question-table');

        /*
         * Inicializa os listeners que permitem ao usuário selecionar e 
         * adicionar questões ao conteúdo
         *  
         * 
         */
        initSelectionFunctionality = function () {
            // Configura o DataTable com as opções desejadas
            initDataTable();
            
            /*
             * Carrega as questões da disciplina selecionada no DataTable
             * 
             */
            $('.topic-info').click(function () {
                $('.last-selected').first().removeClass('last-selected');
                
                $('#table-content-title').text($(this).data('name'));
                $(this).addClass('last-selected');
                
                if (typeof sQuestionsDatatable[+$(this).data('id')] !== 'undefined') {
                    setDatatable(sQuestionsDatatable[+$(this).data('id')]);
                } else {
                    questionTable.DataTable().ajax.reload();
                }
            });

            /*
             * Recarrega as questões da disciplina selecionada no DataTable
             * 
             */
            $('#refresh-button').click(function () {
                questionTable.DataTable().ajax.reload();
            });
            
            /*
             * Adiciona todas as questões selecionadas
             * 
             */
            $('.add-question').click(function () {
                $('#question-table > tbody > .cats-selected-row').each(function () {
                    $(this).removeClass('cats-selected-row');
                    $(this).removeClass('cats-row');
                    $(this).css('opacity', 0.4);
                    
                    var questionInfo = examQuestions[+$(this).data('id')];            
                    var topicInfo = $('#topic-info-' + questionInfo.topicId);
                    var subjectInfo = topicInfo.closest('.subject-info');
                    
                    addQuestion(                            
                            {
                                id: +$(this).data('id'),
                                enunciation: questionInfo.enunciation,
                                alternatives: questionInfo.alternatives,
                                correctAlternative: questionInfo.correctAlternative,
                                new: true,
                                subject: {
                                    id: +subjectInfo.data('id'),
                                    name: subjectInfo.data('name'),
                                    parallel: subjectInfo.hasClass('parallel-subject'),
                                    singleColumn: subjectInfo.hasClass('single-column-subject')
                                }
                            },
                            {
                                divObj: $('.content-questions').first(),
                                baseSubjectId: +topicInfo.closest('.base-subject-info').data('id'),
                                numberingStart: +$('#questions-start-at-number').text()
                            },
                            true
                    );
                    
                });
                
                if (autosaveIsOn()) {
                    saveContent();
                }
            });
        };
        
        /*
         *  Listeners que permitem a alteração do conteúdo
         */
        setListeners = function () {
            /*
             * Evento: clique no botão #save-content
             * Salva o conteúdo
             * 
             */
            $('#save-content').click(function () {
                saveContent();
            });

            /*
             * Evento: clique sobre o ícone de remoção
             * Remove a questão associada ao ícone
             * 
             */
            $('.content-questions').on('click', '.rm-question', function () {
                var qId = +$(this).closest('.question-block').data('id');                
                removeQuestion(qId);
                removeAddedFlag(qId);
                
                if (autosaveIsOn()) {
                    saveContent();
                }
                
                function removeAddedFlag(qId) {
                    var questionRow = $('#question-' + qId);
                    questionRow.find('td').removeClass('cats-selected-bg');
                    questionRow.addClass('cats-row');
                    questionRow.css('opacity', 1);
                }
            });

            /*
             * Evento: clique sobre o ícone de "mover para cima"
             * Troca a posição da questão associada ao ícone com a questão de 
             * cima, se ela existir e for da mesma disciplina.
             * 
             */
            $('.content-questions').on('click', '.move-up', function () {
                var qBlock = $(this).closest('.question-block');
                var previousQBlock = qBlock.prev('.question-block');
                
                if (previousQBlock.length === 0) {
                    return;
                }
                
                if (previousQBlock.length !== 0) {
                    decrementQuestionNumber(qBlock);
                    incrementQuestionNumber(previousQBlock);
                    
                    qBlock.detach().insertBefore(previousQBlock);
                }
                
                var baseSubjectId = +qBlock.closest('.base-subject-block').data('id');
                var questionAId = +qBlock.data('id');
                var subjectAId = +qBlock.data('subject-id');
                var questionBId = +previousQBlock.data('id');
                var subjectBId = +previousQBlock.data('subject-id');
                
                updateConfig(baseSubjectId, subjectAId, questionAId, subjectBId, questionBId);
                               
                if (autosaveIsOn()) {
                    saveContent();
                }
            });

            /*
             * Evento: clique sobre o ícone de "mover para baixo"
             * Troca a posição da questão associada ao ícone com a questão de 
             * baixo, se ela existir e for da mesma disciplina.
             * 
             */
            $('.content-questions').on('click', '.move-down', function () {
                var qBlock = $(this).closest('.question-block');
                var nextQBlock = qBlock.next('.question-block');
                
                if (nextQBlock.length === 0) {
                    return;
                }
                
                if (nextQBlock.length !== 0) {
                    decrementQuestionNumber(nextQBlock);
                    incrementQuestionNumber(qBlock);
                    
                    qBlock.detach().insertAfter(nextQBlock);
                }
                
                var baseSubjectId = +qBlock.closest('.base-subject-block').data('id');
                var questionAId = +qBlock.data('id');
                var subjectAId = +qBlock.data('subject-id');
                var questionBId = +nextQBlock.data('id');
                var subjectBId = +nextQBlock.data('subject-id');
                
                updateConfig(baseSubjectId, subjectAId, questionAId, subjectBId, questionBId);
                                
                if (autosaveIsOn()) {
                    saveContent();
                }
            });
            
            function incrementQuestionNumber(qBlock) {
                var qNumberBlock = qBlock.find('.q-number').first();

                qNumberBlock.text(+qNumberBlock.text() + 1);
            }
            
            function decrementQuestionNumber(qBlock) {
                var qNumberBlock = qBlock.find('.q-number').first();

                qNumberBlock.text(+qNumberBlock.text() - 1);              
            }
            
            function updateConfig(
                    baseSubjectId, 
                    subjectAId, questionAId,
                    subjectBId, questionBId) {                
                var subgroupA = findSubgroup(baseSubjectId, subjectAId);
                var subgroupB = findSubgroup(baseSubjectId, subjectBId);
                var qAIndex = 0;
                var qBIndex = 0;
                
                for (var i = 0; i < subgroupA.questions.length; ++i) {
                    if (+subgroupA.questions[i].id === questionAId) {
                        qAIndex = i;
                        break;
                    }
                }
                
                for (var i = 0; i < subgroupB.questions.length; ++i) {
                    if (+subgroupB.questions[i].id === questionBId) {
                        qBIndex = i;
                        break;
                    }
                }
                
                var qA = subgroupA.questions[qAIndex];
                subgroupA.questions[qAIndex] = subgroupB.questions[qBIndex];
                subgroupB.questions[qBIndex] = qA;           
            }
        };
        
        /*
         * Retorna true se o conteúdo estiver configurado para ser salvo 
         * automaticamente a cada mudança
         * 
         * @returns {boolean}
         */
        autosaveIsOn = function () {
            return $('#autosaving').is(':checked');
        };

        /*
         * Remove os dados do DataTable e insere os contidos em 'data'
         * 
         * @param {array} data - Array de objetos contendo as informações a 
         * serem carregadas na tabela
         * 
         * data contém:
         *      DT_RowAttr: (Objeto que determina os atributos de cada linha da tabela)
         *      0: (Primeira coluna - checkbox com o id da questão)
         *      1: (Segunda coluna - Descrição da questão)
         * }
         */
        setDatatable = function (data) {
            questionTable.DataTable().clear();
            questionTable.DataTable().rows.add(data).draw();
        };

        /*
         * Inicializa a tabela e define a forma de obtenção de dados por ajax 
         * em 'dataSrc'
         * 
         */
        initDataTable = function () {            
            questionTable.DataTable({
                dom: '<"top"p>t<"bottom"p><"clear">',
                autoWidth: false,
                ajax: {
                    url: "/school-management/school-exam/get-subject-questions",
                    type: "POST",
                    data: function () {
                        return {
                            subject: +$(".last-selected").first().data('id'),
                            questionType: -1
                        };
                    },
                    dataSrc: function (data) {
                        var questions = [];
                        var sId = +$(".last-selected").first().data('id');
                        
                        for (var i = 0; i < data.length; ++i) {
                            // "cache"
                            examQuestions[data[i].questionId] = {
                                enunciation: data[i].questionEnunciation,
                                alternatives: data[i].questionAlternatives,
                                correctAlternative: data[i].questionCorrectAlternative,
                                topicId: data[i].questionSubjectId
                            };
                            
                            // Objeto para preencher a tabela
                            questions.push({
                                DT_RowClass: "cats-row",
                                DT_RowAttr: {
                                    "id": "question-" + data[i].questionId,
                                    "data-id": data[i].questionId
                                },
                                0: data[i].questionEnunciation
                            });
                        }
                        sQuestionsDatatable[sId] = questions;

                        return questions;
                    }
                },
                // executado após cada linha da tabela ser criada
                createdRow: function(row, data, dataIndex) {
                    // adicionar borda as células
                    $.each($('td', row), function (colIndex) {
                        $(this).attr('style', "border: 1px solid lightgray");
                    });
                    
                    // selecionar questões adicionadas
                    if (selectedQuestions[(+$(row).data('id'))]) {
                        $(row).find('td').addClass('cats-selected-bg');
                        $(row).removeClass('cats-row');
                        $(row).css('opacity', 0.4);
                    }
                }
            });
        };
        
        /*
         * Salva o conteúdo
         * 
         */
        saveContent = function() {
            $.ajax({
                method: "POST",
                url: '/school-management/school-exam/save-content',
                data: {
                    contentId: +$('#content-info').data('id'),
                    config: JSON.stringify(contentConfig)
                }
            });
            
        };

        /*
         * 
         * @param {integer} contentId - id do conteúdo
         */
        loadContent = function(contentId, divObj, updateStats) {
            $.ajax({
                method: "POST",
                url: '/school-management/school-exam/get-content',
                data: {
                    contentId: contentId
                }
            }).done(function(response) {
                contentConfig = JSON.parse(response.config);
                var groups = contentConfig.groups;
                
                for (var i = 0; i < groups.length; ++i) {
                    addBaseSubjectBlock(groups[i], divObj);
                    
                    for (var j = 0; j < groups[i].subgroups.length; ++j) {
                        var parallelSubject = false;
                        
                        if (Array.isArray(groups[i].subgroups[j])) {
                            parallelSubject = true;
                            addParallelSubjectBlock(groups[i].subgroups[j]);
                            
                            for (var k = 0; k < groups[i].subgroups[j].length; ++k) {
                                if (updateStats) {
                                    setSubjectInfo(
                                            groups[i], 
                                            groups[i].subgroups[j][k], 
                                            parallelSubject
                                    );
                                }
                                
                                loadSubject(
                                        {
                                            baseSubjectId: groups[i].id,
                                            numberingStart: contentConfig.questionsStartAtNumber, 
                                            divObj: divObj
                                        },
                                        groups[i].subgroups[j][k],
                                        parallelSubject,
                                        updateStats
                                );
                            }
                        } else {
                            if (updateStats) {
                                setSubjectInfo(
                                        groups[i], 
                                        groups[i].subgroups[j], 
                                        parallelSubject
                                );
                            }
                            if (groups[i].subgroups[j].singleColumn === true) {  
                                addSingleColumnSubjectBlock(groups[i], groups[i].subgroups[j], divObj);
                            }          
                            
                            loadSubject(
                                    {
                                        baseSubjectId: groups[i].id,
                                        numberingStart: contentConfig.questionsStartAtNumber, 
                                        divObj: divObj
                                    },
                                    groups[i].subgroups[j],
                                    parallelSubject,
                                    updateStats
                            );
                        }
                    }
                }
                
                $('#questions-count').text(contentConfig.numberOfQuestions);
            });
            
            function addBaseSubjectBlock(group, divObj) {
                var baseSubjectTemplate = $('#base-subject-template > div').clone();

                baseSubjectTemplate.addClass('s-' + group.id);
                baseSubjectTemplate.attr('data-id', group.id);
                baseSubjectTemplate.attr('data-name', group.groupName);
                baseSubjectTemplate.find('.title').text(group.groupName);

                divObj.append(baseSubjectTemplate);
            }
            
            function addParallelSubjectBlock(parallelSubjects) {
                var parallelSubjectsTemplate = $('#parallel-subjects-template > div').clone();
                
                for (var k = 0; k < parallelSubjects.length; ++k) {
                    var parallelSubjectTemplate = $('#parallel-subject-template > div').clone();
                    parallelSubjectTemplate.addClass('s-' + parallelSubjects[k].id);
                    parallelSubjectTemplate.attr('data-id', parallelSubjects[k].id);
                    parallelSubjectTemplate.attr('data-name', parallelSubjects[k].subgroupName);
                    parallelSubjectTemplate.find('.title').text('OPÇÃO: ' + parallelSubjects[k].subgroupName);
                    parallelSubjectsTemplate.append(parallelSubjectTemplate);
                }
                
                divObj.find('.base-subject-block').last().append(parallelSubjectsTemplate);
            }
            
            
            function setSubjectInfo(baseSubject, subject, parallel) {
                var subjectInfoBlock = $('#subject-info-' + subject.id);
                
                var amount = +subject.numberOfProposedQuestions;
                subjectInfoBlock.find('.q-amount').first().text(amount);
                
                if (parallel) {
                    subjectInfoBlock.addClass('parallel-subject');
                } else if (subject.singleColumn) {
                    subjectInfoBlock.addClass('single-column-subject');
                }
            }
            
            function addSingleColumnSubjectBlock(baseSubject, subject, divObj) {
                var singleColumnSubjectTemplate = $('#single-column-subject-template > div').clone();
                
                singleColumnSubjectTemplate.addClass('s-' + subject.id);
                singleColumnSubjectTemplate.data('id', subject.id);
                divObj.find('.s-' + baseSubject.id).first().append(singleColumnSubjectTemplate);
            }
            
            function loadSubject(context, subgroup, parallelSubject, updateStats) {
                var questionsIds = [];
                
                for (var i = 0; i < subgroup.questions.length; ++i) {
                    questionsIds.push(subgroup.questions[i].id);
                }
                
                loadQuestions(
                        questionsIds,
                        context,
                        {
                            id: subgroup.id,
                            name: subgroup.subgroupName,
                            parallel: parallelSubject,
                            singleColumn: subgroup.singleColumn,
                        },
                        updateStats
                );
            }
            
            /*
            * Carrega todas as questões do conteúdo
            * 
            */
            function loadQuestions(questionsIds, context, subject, updateStats) {
                $.ajax({
                     method: "POST",
                     url: '/school-management/school-exam/get-questions',
                     data: {
                         questions: questionsIds
                     }
                }).done(function(questions) {
                    addLoadedQuestions(
                            questions,
                            context, 
                            subject, 
                            updateStats
                    );
                });
            }
            
            /**
            * Carrega as questões
            * 
            * @param {array} questions
            *      questions = [
            *          {
            *              id: <number>
            *              subjectId: <number>,
            *              baseSubjectId: <number>,
            *              enunciation: <string>, 
            *              alternatives: [
            *                  <string>,
            *                  ...
            *              ]
            *              answer: <number>,
            *          },
            *          .
            *          .
            *          . 
            *      ]
            */
            addLoadedQuestions = function (questions, context, subject, updateStats) {
                var total = questions.length;
                for (var i = 0; i < total; ++i) {
                    examQuestions[questions[i].questionId] = {
                        enunciation: questions[i].questionEnunciation,
                        alternatives: questions[i].questionAlternatives,
                        correctAlternative: questions[i].questionCorrectAlternative,
                        topicId: questions[i].questionSubjectId
                    };
                    
                    addQuestion(
                            {
                                id: questions[i].questionId,
                                enunciation: questions[i].questionEnunciation,
                                alternatives: questions[i].questionAlternatives,
                                correctAlternative: questions[i].questionCorrectAlternative,
                                new: false,
                                subject: {
                                    id: subject.id,
                                    name: subject.name,
                                    parallel: subject.parallel, 
                                    singleColumn: subject.singleColumn
                                },
                            },
                            {
                                divObj: context.divObj,
                                baseSubjectId: context.baseSubjectId,
                                numberingStart: context.numberingStart
                            }, 
                            true
                    );
                }
            };
        };


        /*
         * Adiciona uma questão ao conteúdo
         * 
         * @param {object} question - objeto com os dados da questão
         *  questionId
         *  
         *  question = {
         *      id: <number>,
         *      enunciation: <string>,
         *      alternatives: [
         *          <string>,
         *          ...
         *      ],
         *      correctAlternative: <number>,
         *      new: <boolean>,
         *      subject: {
         *          id: <number>,
         *          name: <string>,
         *          parallel: <boolean>,
         *          singleColumn: <boolean>
         *      },
         *      baseSubject: {
         *          id: <number>
         *      }
         *      
         *  }
         * 
         */
        addQuestion = function (question, context, updateStats) {
            //  questão já adicionada
            if (selectedQuestions[question.id]) {
                return;
            }
            
            var questionInfo = examQuestions[question.id];            
            var topicInfo = $('#topic-info-' + questionInfo.topicId);
            var subjectInfo = topicInfo.closest('.subject-info');
            
            var subjectId = question.subject.id;
            var subjectName = question.subject.name;
            var baseSubjectId = context.baseSubjectId;
            
            incrementQuestionCounter();
            
            var controlIconsTemplate = $('#control-icons-template > span').clone();
            if (question.subject.singleColumn) {
                var questionBlock = $('#single-column-question-template > div').clone();
                
                if (!context.divObj.parent().hasClass('view-only')) {
                    questionBlock.prepend(controlIconsTemplate);
                }
                
                questionBlock.attr('id', 'q-' + question.id);
                questionBlock.attr('data-id', question.id);
                questionBlock.attr('data-subject-id', subjectId);
                questionBlock.attr('data-subject-name', subjectName);
                questionBlock.append(question.enunciation);
                context.divObj.find('.s-' + subjectId).first().append(questionBlock);
            } else {                
                var questionBlock = $('#question-template > div').clone();
                
                if (!context.divObj.parent().hasClass('view-only')) {
                    questionBlock.prepend(controlIconsTemplate);
                }
                
                questionBlock.attr('id', 'q-' + question.id);
                questionBlock.attr('data-id', question.id);
                questionBlock.attr('data-subject-id', subjectId);
                questionBlock.attr('data-subject-name', subjectName);
                questionBlock.attr('data-correct-alternative', question.correctAlternative);
                questionBlock.find('.q-number').first().text(questionCount);
                questionBlock.find('hr').before(question.enunciation);               
                
                for (var i = 0; i < question.alternatives.length; ++i) {
                    var alternative = $('#question-alternative-template > div').clone();
                    
                    alternative.find('.question-alternative-identifier').first()
                            .append('&#' + (9398 + i) + ';');            
                    alternative.append(question.alternatives[i]);
                    questionBlock.find('hr').before(alternative);
                }
                
                if (question.subject.parallel) {
                    context.divObj.find('.s-' + subjectId).first().append(questionBlock);
                } else {
                    context.divObj.find('.s-' + baseSubjectId).first().append(questionBlock);
                }
            
                numberQuestions(context.numberingStart, context.divObj);
            }
            
            if (updateStats) {
                flagQuestionAsSelected(question.id);
                incrementSubjectCounter(subjectId);
                updateAddedQuestions();
                
                if (question.new) {
                    addToConfig(baseSubjectId, subjectId, subjectName, question.id);
                }
            }
            
            
            function flagQuestionAsSelected(questionId) {
                selectedQuestions[questionId] = true;
            }
            
            function incrementQuestionCounter() {
                ++questionCount;
            }
            
            /*
            * Incrementa o valor do contador de questões da disciplina de id=subjectId
            * 
            * @param {int} subjectId - id da disciplina
            */
            function incrementSubjectCounter(subjectId) {
               var qAdded = $('#subject-info-' + subjectId).find('.q-added');
               qAdded.text(+qAdded.text() + 1);
            }
            
            function addToConfig(baseSubjectId, subjectId, subjectName, questionId) {                
                var subgroup = findSubgroup(baseSubjectId, subjectId);
                
                subgroup.questions.push({
                    id: questionId,
                    subjectId: subjectId,
                    subjectName: subjectName
                });
            }
        };    
        
        /*
         * Atualiza o número de questões adicionadas
         * 
         */
        function updateAddedQuestions() {
            $('#added-questions').text(questionCount);
        };

        /*
         * Numera as questões 
         * 
         */
        numberQuestions = function (beginAt, divObj) {
            var baseSubjects = divObj.find('.base-subject-block');
            var number = beginAt;
            
            baseSubjects.children().each(function () {
                if ($(this).hasClass('parallel-subjects-block')) {
                    var parallelBlockStartNumber = number;
                    
                    $(this).find('.parallel-subject-block').each(function() {
                        number = parallelBlockStartNumber;
                        $(this).find('.q-number').each(function() {
                           $(this).text(number++); 
                        });
                    });
                } else if ($(this).hasClass('question-block')){
                    $(this).find('.q-number').first().text(number++);
                }
            });
        };

        /*
         * Remove uma questão do conteúdo
         * 
         * @param {int} qId - id da questão
         */
        removeQuestion = function (qId) {
            selectedQuestions[qId] = false;
            decrementQuestionCounter();
            
            var qBlock = $('#q-' + qId);
            var qNumber = +qBlock.find('.q-number').text();
            
            var subjectId = +qBlock.data('subject-id');
            var subjectName = qBlock.data('subject-name');
            
            var baseSubjectId = +$('#subject-info-' + subjectId)
                    .closest('.base-subject-info')
                    .data('id');
            
            decrementSubjectCounter(subjectId);
            qBlock.remove();        
            numberQuestions(
                    +$('#questions-start-at-number').text(), 
                    $('.content-questions').first()
            );
            
            removeFromConfig(baseSubjectId, subjectId, qId);
            /*
            * 
            * 
            * @param {int} subjectId - id da disciplina
            */
            function decrementSubjectCounter(subjectId) {
               var qAdded = $('#subject-info-' + subjectId).find('.q-added');
               qAdded.text(qAdded.text() - 1);
            };
            
            function decrementQuestionCounter() {
                --questionCount; 
                updateAddedQuestions();
            }
            
            function removeFromConfig(baseSubjectId, subjectId, questionId) {                
                var subgroup = findSubgroup(baseSubjectId, subjectId);
                
                for (var i = 0; i < subgroup.questions.length; ++i) {
                    if (subgroup.questions[i].id === questionId) {
                        subgroup.questions.splice(i, 1);
                        break;
                    }
                }
            }
        };
        
        findSubgroup = function(baseSubjectId, subjectId) {
            var subgroup = {
                questions: []
            };
            
            for (var i = 0; i < contentConfig.groups.length; ++i) {
                if (contentConfig.groups[i].id === baseSubjectId) {

                    for (var j = 0; j < contentConfig.groups[i].subgroups.length; ++j) {
                        // disciplina paralela
                        if (Array.isArray(contentConfig.groups[i].subgroups[j])) {
                            for (var k = 0; k < contentConfig.groups[i].subgroups[j].length; ++k) {
                                if (contentConfig.groups[i].subgroups[j][k].id === subjectId) {
                                    subgroup = contentConfig.groups[i].subgroups[j][k];
                                    break;
                                }
                            }
                        } else if (contentConfig.groups[i].subgroups[j].id === subjectId) {
                            subgroup = contentConfig.groups[i].subgroups[j];
                            break;
                        }
                    }
                }
            }
            
            return subgroup;
        };

        return {
            init: function () {
                initSelectionFunctionality();
                setListeners();
                loadContent(
                        +$('#content-info').data('id'), 
                        $('.content-questions').first(), 
                        true
                );
            },
            loadContent: loadContent
        };

    }());

    return prepare;
});
